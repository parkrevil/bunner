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
