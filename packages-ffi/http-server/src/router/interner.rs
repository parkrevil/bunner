use dashmap::DashMap;
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
        let mut rev = self.rev.write();
        if let Some(id) = self.map.get(s).map(|v| *v) {
            return id;
        }
        let id = rev.len() as u32;
        rev.push(s.to_string());
        self.map.insert(s.to_string(), id);
        id
    }
    #[inline]
    pub fn get(&self, s: &str) -> Option<u32> {
        self.map.get(s).map(|v| *v)
    }
    // end impl
}
