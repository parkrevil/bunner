use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};

pub trait Middleware: Send + Sync {
    // return true to continue, false to stop chain immediately
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool;
}

pub struct Chain {
    layers: Vec<Box<dyn Middleware>>,
}

impl Chain {
    pub fn new() -> Self {
        Self { layers: Vec::new() }
    }

    pub fn with(mut self, mw: impl Middleware + 'static) -> Self {
        self.layers.push(Box::new(mw));
        self
    }

    pub fn add(&mut self, mw: impl Middleware + 'static) {
        self.layers.push(Box::new(mw));
    }

    #[tracing::instrument(level = "trace", skip(self, req, res, payload), fields(layers=self.layers.len() as u64))]
    pub fn execute(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        for (idx, layer) in self.layers.iter().enumerate() {
            tracing::event!(
                tracing::Level::TRACE,
                operation = "mw_handle",
                index = idx as u64
            );
            if !layer.handle(req, res, payload) {
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "mw_stop",
                    index = idx as u64
                );
                return false;
            }
        }

        true
    }
}

impl Default for Chain {
    fn default() -> Self {
        Self::new()
    }
}
