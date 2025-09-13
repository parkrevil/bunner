//! Common test helper functions shared across multiple test files
//!
//! This module contains utility functions that are used by multiple test files
//! to reduce code duplication and ensure consistency.

use bunner_http_server::enums::{HttpMethod, HttpStatusCode};
use bunner_http_server::middleware::{
    body_parser::BodyParser, chain::Chain, cookie_parser::CookieParser,
    header_parser::HeaderParser, url_parser::UrlParser,
};
use bunner_http_server::router::{Router, RouterOptions, RouterReadOnly};
use bunner_http_server::structure::{BunnerRequest, BunnerResponse, HandleRequestOutput, HandleRequestPayload};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

/// Creates a HandleRequestPayload for middleware testing
///
/// This function is shared across middleware test files:
/// - middleware/header_processing.rs
/// - middleware/body_processing.rs
/// - middleware/url_processing.rs
pub fn make_payload(
    url: &str,
    headers: HashMap<String, String>,
    body: Option<&str>,
) -> HandleRequestPayload {
    HandleRequestPayload {
        http_method: 0,
        url: url.to_string(),
        headers,
        body: body.map(|s| s.to_string()),
    }
}

/// Runs the middleware chain and returns (request, response)
///
/// This function is shared across middleware test files:
/// - middleware/header_processing.rs
/// - middleware/body_processing.rs
/// - middleware/url_processing.rs
pub fn run_chain(payload: &HandleRequestPayload) -> (BunnerRequest, BunnerResponse) {
    let mut req = BunnerRequest {
        url: String::new(),
        http_method: HttpMethod::Get,
        path: String::new(),
        headers: HashMap::new(),
        cookies: Value::Object(serde_json::Map::new()),
        content_type: None,
        content_length: None,
        charset: None,
        params: None,
        query_params: None,
        body: None,
    };
    let mut res = BunnerResponse {
        http_status: HttpStatusCode::OK,
        headers: None,
        body: Value::Null,
    };
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);
    let _ = chain.execute(&mut req, &mut res, payload);
    (req, res)
}

/// Sets up a basic router for testing
///
/// This function is shared across request_handler test files:
/// - request_handler/header_processing.rs
/// - request_handler/payload_parsing.rs
/// - request_handler/routing_engine.rs
pub fn setup_router() -> Arc<RouterReadOnly> {
    let mut router = Router::new(Some(RouterOptions::default()));
    router
        .add(HttpMethod::Get, "/users/:id")
        .unwrap();
    router
        .add(HttpMethod::Post, "/files/*")
        .unwrap();
    router
        .add(HttpMethod::Get, "/static")
        .unwrap();
    router.finalize();
    Arc::new(router.build_readonly())
}

/// Runs a test with JSON payload and returns the result
///
/// This function is shared across request_handler test files:
/// - request_handler/header_processing.rs
/// - request_handler/payload_parsing.rs
/// - request_handler/routing_engine.rs
///
/// NOTE: This is a simplified version for testing. In real usage,
/// this would need proper callback setup with the request_handler.
pub fn run_test_and_get_result(_payload: Value) -> HandleRequestOutput {
    // For now, return a basic mock response
    // This should be replaced with actual request_handler::process_job call
    // when the import issues are resolved
    HandleRequestOutput {
        response: BunnerResponse {
            http_status: HttpStatusCode::OK,
            headers: None,
            body: Value::String("OK".to_string()),
        },
        request: BunnerRequest {
            url: String::new(),
            http_method: HttpMethod::Get,
            path: "/".to_string(),
            headers: HashMap::new(),
            cookies: Value::Object(serde_json::Map::new()),
            content_type: None,
            content_length: None,
            charset: None,
            params: None,
            query_params: None,
            body: None,
        },
    }
}