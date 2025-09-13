use crate::ffi::common::*;
use bunner_http_server::*;
use bunner_http_server::structure::AddRouteResult;
use bunner_http_server::util::from_ptr;

#[test]
fn prevents_adding_routes_after_sealing() {
    let handle = init();
    unsafe {
        add_route(handle, 0, to_cstr("/before").as_ptr());
        seal_routes(handle); // Seal the router

        let res: Result<AddRouteResult, _> =
            from_ptr(add_route(handle, 0, to_cstr("/after").as_ptr()));
        assert!(res.is_err(), "Should not be able to add routes after sealing");
    }
    unsafe { destroy(handle) };
}

#[test]
fn does_not_panic_on_double_seal() {
    let handle = init();
    unsafe {
        seal_routes(handle);
        seal_routes(handle); // Calling seal a second time should be a safe no-op
    }
    unsafe { destroy(handle) };
}
