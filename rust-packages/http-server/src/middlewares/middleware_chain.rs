use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use super::{Middleware, Lifecycle};

pub struct MiddlewareChain {
    pre_request: Vec<Box<dyn Middleware>>,
    on_request: Vec<Box<dyn Middleware>>,
    before_handle: Vec<Box<dyn Middleware>>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            pre_request: Vec::new(),
            on_request: Vec::new(),
            before_handle: Vec::new(),
        }
    }

    /// Add middleware to a specific lifecycle phase
    pub fn add_to(&mut self, phase: Lifecycle, mw: impl Middleware + 'static) -> &mut Self {
        match phase {
            Lifecycle::PreRequest => self.pre_request.push(Box::new(mw)),
            Lifecycle::OnRequest => self.on_request.push(Box::new(mw)),
            Lifecycle::BeforeHandle => self.before_handle.push(Box::new(mw)),
        }

        self
    }

    #[tracing::instrument(level = "trace", skip(self, req, res, payload))]
    pub fn execute(
        &self,
        phase: Lifecycle,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        let list: &[Box<dyn Middleware>] = match phase {
            Lifecycle::PreRequest => &self.pre_request[..],
            Lifecycle::OnRequest => &self.on_request[..],
            Lifecycle::BeforeHandle => &self.before_handle[..],
        };

        for (idx, layer) in list.iter().enumerate() {
            tracing::event!(
                tracing::Level::TRACE,
                operation = "mw_execute",
                phase = ?phase,
                index = idx as u64
            );

            if !layer.handle(req, res, payload) {
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "mw_stop",
                    phase = ?phase,
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
