use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};

/// Lifecycle phases for middleware execution
#[derive(Clone, Copy, Debug)]
pub enum Lifecycle {
    PreRequest,
    OnRequest,
    BeforeHandle,
}

pub trait Middleware: Send + Sync {
    // return true to continue, false to stop chain immediately
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool;
}
