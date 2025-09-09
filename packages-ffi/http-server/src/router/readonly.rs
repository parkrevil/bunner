use super::{normalize_path, radix_tree::HTTP_METHOD_COUNT, Router};
use crate::r#enum::HttpMethod;
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct RouterReadOnly {
    static_maps: [HashMap<String, u16>; HTTP_METHOD_COUNT],
}

impl RouterReadOnly {
    pub fn from_router(router: &Router) -> Self {
        // Clone static route full mapping into read-only HashMaps
        let mut maps: [HashMap<String, u16>; HTTP_METHOD_COUNT] = Default::default();
        for i in 0..HTTP_METHOD_COUNT {
            let mut out: HashMap<String, u16> =
                HashMap::with_capacity(router.radix_tree.static_route_full_mapping[i].len());
            for (k, v) in router.radix_tree.static_route_full_mapping[i].iter() {
                out.insert(k.clone(), *v);
            }
            maps[i] = out;
        }

        RouterReadOnly { static_maps: maps }
    }

    #[inline]
    pub fn find_static(&self, method: HttpMethod, path: &str) -> Option<u16> {
        let normalized = normalize_path(path);
        let idx = method as usize;
        self.static_maps[idx].get(&normalized).cloned()
    }
}
