// no extra std imports needed

#[repr(C)]
pub struct HttpServer {
    router: parking_lot::RwLock<crate::router::Router>,
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
        let _ = guard.seal();
    }

    pub fn is_routes_sealed(&self) -> bool {
        let guard = self.router.read();

        guard.is_sealed()
    }
}
