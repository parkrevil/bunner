use bunner_http_server::enums::HttpMethod;
use bunner_http_server::enums::HttpStatusCode;
use bunner_http_server::middleware::body_parser::BodyParser;
use bunner_http_server::middleware::chain::Chain;
use bunner_http_server::middleware::cookie_parser::CookieParser;
use bunner_http_server::middleware::header_parser::HeaderParser;
use bunner_http_server::middleware::url_parser::UrlParser;
use bunner_http_server::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::json;
use std::collections::HashMap;

fn make_payload(
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

fn run_chain(payload: &HandleRequestPayload) -> (BunnerRequest, BunnerResponse) {
    let mut req = BunnerRequest {
        url: String::new(),
        http_method: HttpMethod::Get,
        path: String::new(),
        headers: serde_json::Value::Object(serde_json::Map::new()),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
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
        body: serde_json::Value::Null,
    };
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);
    let _ = chain.execute(&mut req, &mut res, payload);
    (req, res)
}

mod header_parsing {
    use super::*;

    #[test]
    fn should_parse_content_type_and_charset() {
        let mut headers = HashMap::new();
        headers.insert(
            "content-type".to_string(),
            "application/json; charset=utf-8".to_string(),
        );
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.content_type.unwrap(), "application/json");
        assert_eq!(req.charset.unwrap(), "utf-8");
    }
}

mod url_parsing {
    use super::*;

    #[test]
    fn should_parse_path_query_and_host_parts() {
        let headers = HashMap::new();
        let payload = make_payload("http://localhost:8080/users/42?q=ok", headers, None);
        let (req, res) = run_chain(&payload);

        assert_eq!(res.http_status, HttpStatusCode::OK);
        assert_eq!(req.path, "/users/42");
        assert_eq!(req.query_params.unwrap().get("q").unwrap(), "ok");
    }

    #[test]
    fn should_allow_empty_keys_or_values_in_query() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?=v&k=", headers, None);
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));
    }

    #[test]
    fn should_parse_array_query_params() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?tags[]=a&tags[]=b&tags[]=c", headers, None);
        let (req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::OK);
        let q = req.query_params.unwrap();
        let tags = q.get("tags").unwrap().as_array().unwrap();
        assert_eq!(tags, &vec![json!("a"), json!("b"), json!("c")]);
    }

    #[test]
    fn should_parse_nested_object_query_params() {
        let headers = HashMap::new();
        let payload = make_payload(
            "http://a.com/a?user[name]=alice&user[id]=42&user[role]=admin",
            headers,
            None,
        );
        let (req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::OK);

        let q = req.query_params.unwrap();
        let user = q.get("user").unwrap();

        assert_eq!(user.get("name").unwrap(), "alice");
        assert_eq!(user.get("id").unwrap(), "42");
        assert_eq!(user.get("role").unwrap(), "admin");
    }

    #[test]
    fn should_parse_5_level_nested_object_query_params() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?a[b][c][d][e]=1", headers, None);
        let (req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::OK);

        let q = req.query_params.unwrap();
        let a = q.get("a").unwrap();
        let b = a.get("b").unwrap();
        let c = b.get("c").unwrap();
        let d = c.get("d").unwrap();
        assert_eq!(d.get("e").unwrap(), "1");
    }

    #[test]
    fn should_return_400_on_invalid_url() {
        let headers = HashMap::new();
        let payload = make_payload("://bad-url", headers, None);
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));
    }

    #[test]
    fn should_return_400_on_invalid_querystring() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?a[=malformed", headers, None);
        let (_req, res) = run_chain(&payload);

        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));
    }

    #[test]
    fn should_reject_duplicate_non_array_keys() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?k=1&k=2", headers, None);
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        assert_eq!(res.body, json!(HttpStatusCode::BadRequest.reason_phrase()));
    }

    #[test]
    fn should_reject_invalid_bracket_forms() {
        let headers = HashMap::new();
        for bad in [
            "http://a.com/a?[k]=v",
            "http://a.com/a?[]=v",
            "http://a.com/a?a[]]=v",
            "http://a.com/a?a[[x]]=v",
        ] {
            let payload = make_payload(bad, headers.clone(), None);
            let (_req, res) = run_chain(&payload);
            assert_eq!(res.http_status, HttpStatusCode::BadRequest);
        }
    }

    #[test]
    fn should_allow_empty_value() {
        let headers = HashMap::new();
        let payload = make_payload("http://a.com/a?k=", headers, None);
        let (req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::OK);
        let q = req.query_params.unwrap();
        assert_eq!(q.get("k").unwrap(), "");
    }
}

mod cookie_parsing {
    use super::*;

    #[test]
    fn should_parse_cookie_header_into_map() {
        let mut headers = HashMap::new();
        headers.insert("cookie".to_string(), "a=1; b=2".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.cookies.get("a").unwrap(), "1");
        assert_eq!(req.cookies.get("b").unwrap(), "2");
    }

    #[test]
    fn should_handle_quoted_and_spaced_cookie_values() {
        let mut headers = HashMap::new();
        headers.insert("cookie".to_string(), "a=\"hello world\"; b=2".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.cookies.get("a").unwrap(), "\"hello world\"");
        assert_eq!(req.cookies.get("b").unwrap(), "2");
    }

    #[test]
    fn should_keep_last_value_for_duplicate_cookie_keys() {
        let mut headers = HashMap::new();
        headers.insert("cookie".to_string(), "a=1; a=2".to_string());
        let payload = make_payload("http://localhost/a", headers, None);
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.cookies.get("a").unwrap(), "2");
    }
}

mod body_parsing {
    use super::*;

    #[test]
    fn should_parse_json_body_when_content_type_is_json() {
        let mut headers = HashMap::new();
        headers.insert(
            "content-type".to_string(),
            "application/json; charset=utf-8".to_string(),
        );
        let payload = make_payload("http://localhost/a", headers, Some("{\"k\":1}"));
        let (req, _res) = run_chain(&payload);
        assert_eq!(req.body.unwrap().get("k").unwrap(), 1);
        assert_eq!(req.charset.as_deref(), Some("utf-8"));
    }

    #[test]
    fn should_keep_plain_text_body_when_non_json() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "text/plain".to_string());
        let payload = make_payload("http://localhost/a", headers, Some("hello"));
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::UnsupportedMediaType);
        assert_eq!(
            res.body,
            json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
        );
    }

    #[test]
    fn should_fallback_to_string_when_json_content_type_but_invalid_json() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());
        let payload = make_payload("http://localhost/a", headers, Some("{invalid}"));
        let (_req, res) = run_chain(&payload);
        assert_eq!(res.http_status, HttpStatusCode::UnsupportedMediaType);
        assert_eq!(
            res.body,
            json!(HttpStatusCode::UnsupportedMediaType.reason_phrase())
        );
    }
}
