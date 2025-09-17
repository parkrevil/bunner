// no extra std imports needed

#[repr(C)]
pub struct HttpServer {
    pub router: parking_lot::RwLock<crate::router::Router>,
    // read-only snapshot moved into `router` itself
}

impl HttpServer {
    pub fn new() -> Self {
        HttpServer {
            router: parking_lot::RwLock::new(crate::router::Router::new(None)),
        }
    }

    pub fn seal_routes(&self) {
        let mut guard = self.router.write();
        let _ = guard.seal_and_reset();
    }
}
