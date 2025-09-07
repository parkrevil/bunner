use bumpalo::Bump;
use hashbrown::HashMap as FastHashMap;

use super::RouterOptions;
use crate::router::interner::Interner;

pub(super) const HTTP_METHOD_COUNT: usize = 7;
pub(super) const HTTP_METHOD_BIT_MASKS: [u8; HTTP_METHOD_COUNT] =
    [1 << 0, 1 << 1, 1 << 2, 1 << 3, 1 << 4, 1 << 5, 1 << 6];

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

use alloc::{NodeBox, create_node_box_from_arena_pointer};
pub use node::RadixTreeNode;

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
}
