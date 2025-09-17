use std::sync::{Arc, OnceLock};

#[repr(C)]
pub struct HttpServer {
    pub router: parking_lot::RwLock<crate::router::Router>,
    pub router_readonly: OnceLock<Arc<crate::router::RouterReadOnly>>,
}

impl HttpServer {
    pub fn new() -> Self {
        HttpServer {
            router: parking_lot::RwLock::new(crate::router::Router::new(None)),
            router_readonly: OnceLock::new(),
        }
    }
}
