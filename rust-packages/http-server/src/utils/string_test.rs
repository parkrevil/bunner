use crate::errors::internal_error::InternalErrorCode;
use crate::test_utils::pointer::with_raw_ptr;
use crate::test_utils::string::{
    make_invalid_utf8_buf, make_large_string, make_len_prefixed_buf, make_mismatched_len_buf,
};
use crate::utils::string::len_prefixed_pointer_to_string;

/// Tests for `len_prefixed_pointer_to_string` behavior
#[cfg(test)]
mod len_prefixed_pointer_to_string {
    use super::*;

    #[test]
    fn returns_string_for_valid_payload() {
        // Arrange
        let s = "hello world";
        let buf = make_len_prefixed_buf(s);

        // Act
        let result = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), s.to_string());
    }

    #[test]
    fn handles_empty_string() {
        // Arrange
        let s = "";
        let buf = make_len_prefixed_buf(s);

        // Act
        let result = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");
    }

    #[test]
    fn handles_unicode_string() {
        // Arrange
        let s = "🦀 crab emoji 🦀";
        let buf = make_len_prefixed_buf(s);

        // Act
        let result = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), s.to_string());
    }

    #[test]
    fn returns_error_on_null_ptr() {
        // Act
        let result = unsafe { len_prefixed_pointer_to_string(std::ptr::null()) };

        // Assert
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            InternalErrorCode::PointerIsNull
        ));
    }

    #[test]
    fn returns_error_on_invalid_utf8() {
        // Arrange: use common helper to build invalid-UTF8 len-prefixed buffer
        let v = make_invalid_utf8_buf(2);

        // Act
        let result = with_raw_ptr(&v, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            InternalErrorCode::InvalidJsonString
        ));
    }

    #[test]
    fn roundtrip_large_string() {
        // Arrange
        let large = make_large_string(10000);
        let buf = make_len_prefixed_buf(&large);

        // Act
        let result = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), large);
    }

    #[test]
    fn header_zero_with_extra_payload_returns_empty() {
        // Arrange: header = 0 but payload exists (use common helper)
        let v = make_mismatched_len_buf(0, b"extra_payload");

        // Act
        let res = with_raw_ptr(&v, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "");
    }

    #[test]
    fn very_large_payload_roundtrip() {
        // Arrange: 1 million characters (use common helper to generate the string)
        let large = make_large_string(1_000_000);
        let buf = make_len_prefixed_buf(&large);

        // Act
        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap().len(), large.len());
    }

    #[test]
    fn randomish_unicode_roundtrip() {
        // Arrange: build a string with a variety of unicode codepoints
        let parts = ["hello", "🦀", "こんにちは", "مرحبا", "😊", "𐍈"];
        let s = parts.join("-");
        let buf = make_len_prefixed_buf(&s);

        // Act
        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s);
    }

    #[test]
    fn returns_substring_when_header_smaller_than_payload() {
        // Arrange: create a buffer where header=3 but payload contains more bytes
        let v = make_mismatched_len_buf(3, b"abcdef");

        // Act
        let res = with_raw_ptr(&v, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "abc");
    }

    #[test]
    fn handles_embedded_nul_bytes() {
        // Arrange
        let s = "a\0b"; // embedded NUL
        let buf = make_len_prefixed_buf(s);

        // Act
        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s.to_string());
    }

    #[test]
    fn handles_control_characters() {
        // Arrange
        let s = "\n\r\t";
        let buf = make_len_prefixed_buf(s);

        // Act
        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s.to_string());
    }
}

/// Tests for `string_to_len_prefixed_buffer` behavior
#[cfg(test)]
mod string_to_len_prefixed_buffer {
    use super::*;

    #[test]
    fn creates_correct_length_prefix() {
        // Arrange
        let s = "abc";

        // Act
        let buf = make_len_prefixed_buf(s);

        // Assert: first 4 bytes are little-endian length (3)
        let len = u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]) as usize;
        assert_eq!(len, 3);
        let payload = &buf[4..];
        assert_eq!(payload, s.as_bytes());
    }

    #[test]
    fn roundtrip_round_trips_via_len_prefixed() {
        // Arrange
        let s = "roundtrip test";
        let buf = make_len_prefixed_buf(s);

        // Act
        let parsed = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        // Assert
        assert!(parsed.is_ok());
        assert_eq!(parsed.unwrap(), s.to_string());
    }
}
// Following TEST_GUIDE.md conventions for unit testing
