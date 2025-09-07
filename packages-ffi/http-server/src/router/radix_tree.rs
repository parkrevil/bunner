use bumpalo::Bump;
use hashbrown::HashMap as FastHashMap;

use super::RouterOptions;
use crate::router::interner::Interner;
use crate::r#enum::HttpMethod;

pub(super) const HTTP_METHOD_COUNT: usize = 7;

#[cfg(not(feature = "test"))]
pub(super) const MAX_ROUTES: u16 = 65_535;

#[cfg(feature = "test")]
pub(super) const MAX_ROUTES: u16 = 100;

const STATIC_MAP_THRESHOLD: usize = 50;

mod alloc;
mod find;
mod insert;
pub mod node;
mod builder;
pub mod traversal;
mod mask;
mod compression;
mod memory;
mod static_map;
mod indices;

use alloc::{NodeBox, create_node_box_from_arena_pointer};
pub use node::RadixTreeNode;
#[cfg(feature = "test")]
use std::sync::atomic::{AtomicUsize, Ordering};

#[cfg(feature = "test")]
static WORKERS_USED: AtomicUsize = AtomicUsize::new(0);
#[cfg(feature = "test")]
static ACTIVE_WORKERS: AtomicUsize = AtomicUsize::new(0);
#[cfg(feature = "test")]
static MAX_ACTIVE_WORKERS: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug, Default)]
pub struct RadixTree {
    pub(super) root_node: RadixTreeNode,
    pub(super) options: RouterOptions,
    pub(super) arena: Bump,
    pub(super) interner: Interner,
    pub(super) method_first_byte_bitmaps: [[u64; 4]; HTTP_METHOD_COUNT],
    pub(super) root_parameter_first_present: [bool; HTTP_METHOD_COUNT],
    pub(super) root_wildcard_present: [bool; HTTP_METHOD_COUNT],
    pub(super) static_route_full_mapping: [FastHashMap<String, u16>; HTTP_METHOD_COUNT],
    pub(super) method_length_buckets: [u64; HTTP_METHOD_COUNT],
    pub enable_root_level_pruning: bool,
    pub enable_static_route_full_mapping: bool,
    pub(super) next_route_key: std::sync::atomic::AtomicU16,
}

impl RadixTree {
    pub fn new(configuration: RouterOptions) -> Self {
        Self {
            root_node: RadixTreeNode::default(),
            options: configuration,
            arena: Bump::with_capacity(64 * 1024),
            interner: Interner::new(),
            method_first_byte_bitmaps: [[0; 4]; HTTP_METHOD_COUNT],
            root_parameter_first_present: [false; HTTP_METHOD_COUNT],
            root_wildcard_present: [false; HTTP_METHOD_COUNT],
            static_route_full_mapping: Default::default(),
            method_length_buckets: [0; HTTP_METHOD_COUNT],
            enable_root_level_pruning: configuration.enable_root_level_pruning,
            enable_static_route_full_mapping: configuration.enable_static_route_full_mapping,
            next_route_key: std::sync::atomic::AtomicU16::new(1),
        }
    }

    pub fn finalize(&mut self) {
        builder::finalize(self);
    }

    pub fn insert_bulk<I>(&mut self, entries: I) -> Result<Vec<u16>, super::errors::RouterError>
    where
        I: IntoIterator<Item = (HttpMethod, String)>,
    {
        // Phase A: parallel preprocess (normalize/parse)
        let indexed: Vec<(usize, HttpMethod, String)> = entries
            .into_iter()
            .enumerate()
            .map(|(i, (m, p))| (i, m, p))
            .collect();

        let total = indexed.len();
        let mut pre: Vec<(usize, HttpMethod, Vec<crate::router::pattern::SegmentPattern>)> =
            Vec::with_capacity(total);

        if total > 1 {
            use std::sync::mpsc;
            use std::thread;

            #[cfg(feature = "test")]
            use std::sync::{Arc, Barrier};

            let (tx, rx) = mpsc::channel();
            let workers = thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(1)
                .min(total);

            #[cfg(feature = "test")]
            {
                WORKERS_USED.store(workers, Ordering::Relaxed);
                ACTIVE_WORKERS.store(0, Ordering::Relaxed);
                MAX_ACTIVE_WORKERS.store(0, Ordering::Relaxed);
            }

            let chunk_size = total.div_ceil(workers);
            let chunk_refs: Vec<&[(usize, HttpMethod, String)]> = indexed.chunks(chunk_size).collect();
            let mut handles = Vec::with_capacity(chunk_refs.len());

            #[cfg(feature = "test")]
            let start_barrier = Arc::new(Barrier::new(chunk_refs.len()));
            #[cfg(feature = "test")]
            {
                WORKERS_USED.store(chunk_refs.len(), Ordering::Relaxed);
                ACTIVE_WORKERS.store(0, Ordering::Relaxed);
                MAX_ACTIVE_WORKERS.store(0, Ordering::Relaxed);
            }

            for chunk in chunk_refs.into_iter() {
                let txc = tx.clone();
                let local: Vec<(usize, HttpMethod, String)> = chunk.to_vec();

                #[cfg(feature = "test")]
                let barrier_clone = start_barrier.clone();

                handles.push(thread::spawn(move || {
                    #[cfg(feature = "test")]
                    {
                        // synchronize thread start to guarantee overlap
                        barrier_clone.wait();
                        let current = ACTIVE_WORKERS.fetch_add(1, Ordering::Relaxed) + 1;
                        // update max active
                        loop {
                            let prev = MAX_ACTIVE_WORKERS.load(Ordering::Relaxed);
                            if current <= prev {
                                break;
                            }
                            if MAX_ACTIVE_WORKERS
                                .compare_exchange(prev, current, Ordering::Relaxed, Ordering::Relaxed)
                                .is_ok()
                            {
                                break;
                            }
                        }
                    }

                    for (idx, method, path) in local.into_iter() {
                        let parsed = super::radix_tree::insert::prepare_path_segments_standalone(&path);
                        match parsed {
                            Ok(segs) => {
                                // ignore send error if receiver dropped
                                let _ = txc.send(Ok((idx, method, segs)));
                            }
                            Err(e) => {
                                let _ = txc.send(Err((idx, e)));
                            }
                        }
                    }

                    #[cfg(feature = "test")]
                    {
                        let _ = ACTIVE_WORKERS.fetch_sub(1, Ordering::Relaxed);
                    }
                }));
            }
            drop(tx);

            let mut first_err: Option<super::errors::RouterError> = None;
            for msg in rx.iter() {
                match msg {
                    Ok((idx, method, segs)) => pre.push((idx, method, segs)),
                    Err((_idx, e)) => {
                        if first_err.is_none() {
                            first_err = Some(e);
                        }
                    }
                }
            }
            // ensure all workers finished
            for h in handles {
                let _ = h.join();
            }
            if let Some(e) = first_err {
                return Err(e);
            }
        } else {
            // fast path: single item
            for (idx, method, path) in indexed.into_iter() {
                let segs = super::radix_tree::insert::prepare_path_segments_standalone(&path)?;
                pre.push((idx, method, segs));
            }

            #[cfg(feature = "test")]
            {
                WORKERS_USED.store(1, Ordering::Relaxed);
                ACTIVE_WORKERS.store(0, Ordering::Relaxed);
                MAX_ACTIVE_WORKERS.store(1, Ordering::Relaxed);
            }
        }

        // Phase B: ultra-light single commit preserving order
        pre.sort_by_key(|(idx, _, _)| *idx);
        let mut out = vec![0u16; pre.len()];
        for (idx, method, segs) in pre.into_iter() {
            let k = self.insert_parsed(method, segs)?;
            out[idx] = k;
        }
        Ok(out)
    }

    #[cfg(feature = "test")]
    pub fn reset_bulk_metrics(&self) {
        WORKERS_USED.store(0, Ordering::Relaxed);
        ACTIVE_WORKERS.store(0, Ordering::Relaxed);
        MAX_ACTIVE_WORKERS.store(0, Ordering::Relaxed);
    }

    #[cfg(feature = "test")]
    pub fn bulk_metrics(&self) -> (usize, usize) {
        (
            WORKERS_USED.load(Ordering::Relaxed),
            MAX_ACTIVE_WORKERS.load(Ordering::Relaxed),
        )
    }
}
