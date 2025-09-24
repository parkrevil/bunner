#[cfg(test)]
mod parse_cookie_header {
    use super::super::parser::parse_cookie_header;

    #[test]
    fn parses_simple_cookie_pairs() {
        let parsed = parse_cookie_header("session=abc123; theme=dark");

        assert_eq!(parsed.get("session"), Some(&"abc123".to_string()));
        assert_eq!(parsed.get("theme"), Some(&"dark".to_string()));
    }

    #[test]
    fn ignores_malformed_cookie_segments() {
        let parsed = parse_cookie_header("session=valid; invalid_segment; flag");

        assert_eq!(parsed.get("session"), Some(&"valid".to_string()));
        assert_eq!(parsed.len(), 1);
    }

    #[test]
    fn returns_empty_map_for_empty_header() {
        let parsed = parse_cookie_header("");

        assert!(parsed.is_empty());
    }

    #[test]
    fn preserves_wrapping_quotes_in_values() {
        let parsed = parse_cookie_header("token=\"hello world\"; theme=dark");

        assert_eq!(parsed.get("token"), Some(&"\"hello world\"".to_string()));
        assert_eq!(parsed.get("theme"), Some(&"dark".to_string()));
    }

    #[test]
    fn keeps_last_value_for_duplicate_keys() {
        let parsed = parse_cookie_header("id=first; id=second");

        assert_eq!(parsed.get("id"), Some(&"second".to_string()));
        assert_eq!(parsed.len(), 1);
    }

    #[test]
    fn preserves_empty_value_pairs() {
        let parsed = parse_cookie_header("empty=; token=abc");

        assert_eq!(parsed.get("empty"), Some(&"".to_string()));
        assert_eq!(parsed.get("token"), Some(&"abc".to_string()));
    }

    #[test]
    fn trims_whitespace_around_names_and_values() {
        let parsed = parse_cookie_header(" theme = light ; session = abc123 ");

        assert_eq!(parsed.get("theme"), Some(&"light".to_string()));
        assert_eq!(parsed.get("session"), Some(&"abc123".to_string()));
        assert_eq!(parsed.len(), 2);
    }
}
