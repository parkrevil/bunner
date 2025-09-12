use dashmap::{mapref::entry::Entry, DashMap};
use parking_lot::RwLock;

#[derive(Debug, Default)]
pub struct Interner {
    map: DashMap<String, u32>,
    rev: RwLock<Vec<String>>,
}

impl Interner {
    pub fn new() -> Self {
        Self {
            map: DashMap::new(),
            rev: RwLock::new(Vec::new()),
        }
    }

    #[inline]
    pub fn intern(&self, s: &str) -> u32 {
        if let Some(id) = self.map.get(s).map(|v| *v) {
            return id;
        }

        // Acquire reverse table lock once; use entry to avoid a second get.
        let mut rev = self.rev.write();
        match self.map.entry(s.to_string()) {
            Entry::Occupied(e) => *e.get(),
            Entry::Vacant(v) => {
                let id = rev.len() as u32;
                rev.push(s.to_string());
                v.insert(id);
                id
            }
        }
    }

    #[cfg(any(feature = "production", feature = "test"))]
    #[inline]
    pub fn runtime_cleanup(&self) {
        // After finalize in production, we only need forward lookups via `get`.
        // Free reverse table capacity to reduce memory footprint.
        let mut rev = self.rev.write();
        rev.clear();
        rev.shrink_to_fit();
    }
    // end impl
}
