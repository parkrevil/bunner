use super::utils;

#[cfg(test)]
mod first_header_value {
    use super::utils::first_header_value;

    #[test]
    fn returns_first_trimmed_segment() {
        let value = first_header_value("  Bearer token  , second");

        assert_eq!(value.as_deref(), Some("Bearer token"));
    }

    #[test]
    fn trims_carriage_return_and_newline() {
        let value = first_header_value("  Token\r\n, other");

        assert_eq!(value.as_deref(), Some("Token"));
    }

    #[test]
    fn returns_none_for_empty_first_segment() {
        let value = first_header_value(",  follow-up");

        assert!(value.is_none());
    }

    #[test]
    fn returns_none_when_input_is_blank() {
        let value = first_header_value("   ");

        assert!(value.is_none());
    }
}

#[cfg(test)]
mod strip_surrounding_quotes {
    use super::utils::strip_surrounding_quotes;

    #[test]
    fn removes_matching_double_quotes_and_whitespace() {
        let value = strip_surrounding_quotes("  \"value\"  ");

        assert_eq!(value, "value");
    }

    #[test]
    fn trims_content_within_quotes() {
        let value = strip_surrounding_quotes("\"  spaced value  \"");

        assert_eq!(value, "spaced value");
    }

    #[test]
    fn removes_matching_single_quotes_and_whitespace() {
        let value = strip_surrounding_quotes("  'value'  ");

        assert_eq!(value, "value");
    }

    #[test]
    fn preserves_mismatched_quotes() {
        let value = strip_surrounding_quotes("'value\"");

        assert_eq!(value, "'value\"");
    }

    #[test]
    fn trims_without_quotes() {
        let value = strip_surrounding_quotes("  value  ");

        assert_eq!(value, "value");
    }
}
