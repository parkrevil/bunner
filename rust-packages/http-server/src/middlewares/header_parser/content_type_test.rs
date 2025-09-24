use super::content_type;

#[cfg(test)]
mod parse_content_type {
    use super::content_type::parse_content_type;

    #[test]
    fn parses_media_type_without_parameters() {
        let (media_type, parameters) = parse_content_type("  Text/HTML  ").unwrap();

        assert_eq!(media_type, "text/html");
        assert!(parameters.is_empty());
    }

    #[test]
    fn parses_parameters_with_quotes_and_whitespace() {
        let (media_type, parameters) = parse_content_type(
            "application/json; charset=\"UTF-8\"; boundary= multipart",
        )
        .unwrap();

        assert_eq!(media_type, "application/json");
        assert_eq!(parameters.get("charset"), Some(&"UTF-8".to_string()));
        assert_eq!(parameters.get("boundary"), Some(&"multipart".to_string()));
    }

    #[test]
    fn ignores_duplicate_parameters() {
        let (_, parameters) =
            parse_content_type("text/plain; charset=utf-8; charset=iso-8859-1").unwrap();

        assert_eq!(parameters.len(), 1);
        assert_eq!(parameters.get("charset"), Some(&"utf-8".to_string()));
    }

    #[test]
    fn returns_error_on_empty_input() {
        let result = parse_content_type("   ");

        assert!(matches!(result, Err("empty content-type")));
    }

    #[test]
    fn returns_error_on_missing_media_type() {
        let result = parse_content_type("; charset=utf-8");

        assert!(matches!(result, Err("empty media type")));
    }

    #[test]
    fn collects_parameters_with_single_quotes() {
        let (_, parameters) =
            parse_content_type("application/xml; charset='utf-8'; version='1.0'").unwrap();

        assert_eq!(parameters.get("charset"), Some(&"utf-8".to_string()));
        assert_eq!(parameters.get("version"), Some(&"1.0".to_string()));
    }

    #[test]
    fn treats_missing_parameter_value_as_empty_string() {
        let (_, parameters) = parse_content_type("text/plain; charset=").unwrap();

        assert_eq!(parameters.get("charset"), Some(&String::new()));
    }

    #[test]
    fn skips_empty_parameter_segments() {
        let (_, parameters) = parse_content_type("text/plain; charset=utf-8; ; ; q=0.5").unwrap();

        assert_eq!(parameters.len(), 2);
        assert_eq!(parameters.get("charset"), Some(&"utf-8".to_string()));
        assert_eq!(parameters.get("q"), Some(&"0.5".to_string()));
    }

    #[test]
    fn normalizes_media_type_and_parameter_keys() {
        let (media_type, parameters) =
            parse_content_type("TEXT/HTML; Charset=UTF-8; BOUNDARY=Mixed").unwrap();

        assert_eq!(media_type, "text/html");
        assert_eq!(parameters.get("charset"), Some(&"UTF-8".to_string()));
        assert_eq!(parameters.get("boundary"), Some(&"Mixed".to_string()));
    }

    #[test]
    fn handles_parameter_without_equals_sign() {
        let (_, parameters) = parse_content_type("text/plain; param").unwrap();

        assert_eq!(parameters.len(), 1);
        assert_eq!(parameters.get("param"), Some(&String::new()));
    }
}
