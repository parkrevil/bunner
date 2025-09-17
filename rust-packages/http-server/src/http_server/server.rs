use crate::router::Router;

#[repr(C)]
pub struct HttpServer {
    router: Router,
    // read-only snapshot moved into `router` itself
}

impl HttpServer {
    pub fn new() -> Self {
        HttpServer {
            router: Router::new(None),
        }
    }

    pub fn add_route() {}

    pub fn seal_routes(&self) {
        self.router.seal();
    }

    pub fn is_routes_sealed(&self) -> bool {
        self.router.is_sealed()
    }
}
