use crate::enums::HttpMethod;
use crate::request_handler::RequestHandler;
use crate::router::Router;

#[repr(C)]
pub struct App {
    router: Router,
    request_handler: RequestHandler,
}

impl App {
    pub fn new() -> Self {
        App {
            router: Router::new(None),
            request_handler: RequestHandler::new(),
        }
    }

    pub fn add_route(
        &self,
        method: HttpMethod,
        path: &str,
    ) -> crate::router::structures::RouterResult<u16> {
        self.router.add(method, &path)
    }

    pub fn add_routes(
        &self,
        routes: Vec<(HttpMethod, String)>,
    ) -> crate::router::structures::RouterResult<Vec<u16>> {
        self.router.add_bulk(routes)
    }

    pub fn seal_routes(&self) {
        self.router.seal();
    }

    pub fn is_routes_sealed(&self) -> bool {
        self.router.is_sealed()
    }
}
