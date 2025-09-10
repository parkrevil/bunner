use crate::structure::BunnerRequest;
use crate::structure::BunnerResponse;
use crate::structure::HandleRequestPayload;

pub trait Middleware: Send + Sync {
    fn handle(&self, req: &mut BunnerRequest, res: &mut BunnerResponse, payload: &HandleRequestPayload);
}

pub struct Chain {
    layers: Vec<Box<dyn Middleware>>,
}

impl Chain {
    pub fn new() -> Self { Self { layers: Vec::new() } }

    pub fn with(mut self, mw: impl Middleware + 'static) -> Self {
        self.layers.push(Box::new(mw));
        self
    }

    pub fn add(&mut self, mw: impl Middleware + 'static) { self.layers.push(Box::new(mw)); }

    pub fn execute(&self, req: &mut BunnerRequest, res: &mut BunnerResponse, payload: &HandleRequestPayload) {
        for layer in self.layers.iter() {
            layer.handle(req, res, payload);
        }
    }
}

impl Default for Chain {
    fn default() -> Self { Self::new() }
}

