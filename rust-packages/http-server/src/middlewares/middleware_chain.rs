use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use super::Middleware;

pub struct MiddlewareChain {
    layers: Vec<Box<dyn Middleware>>,
}

impl MiddlewareChain {
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

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
}
