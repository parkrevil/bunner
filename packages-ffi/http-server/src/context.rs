use crate::middleware::Pipeline;
use crate::router::Router;

pub struct HttpContext {
    pub router: Router,
}

impl HttpContext {
    pub fn new() -> Self {
        Self {
            router: Router::new(),
        }
    }

    pub fn handle(&mut self, method: &str, path: &str) -> u32 {
      let Some(route_key) = self.router.match_route(method, path)
      
        if !route_key.is_some() {
          return 0;
        }

      return route_key.unwrap();
    }
}
