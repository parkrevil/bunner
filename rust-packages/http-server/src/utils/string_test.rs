use crate::errors::internal_error::InternalErrorCode;
use crate::utils::string::{len_prefixed_pointer_to_string, string_to_len_prefixed_buffer};

/// Tests for `len_prefixed_pointer_to_string` behavior
#[cfg(test)]
mod len_prefixed_pointer_to_string {
    use super::*;

    #[test]
    fn returns_string_for_valid_payload() {
        // Arrange
        let s = "hello world";
        let buf = string_to_len_prefixed_buffer(s);

        // Act
        let result = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), s.to_string());
    }

    #[test]
    fn handles_empty_string() {
        // Arrange
        let s = "";
        let buf = string_to_len_prefixed_buffer(s);

        // Act
        let result = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");
    }

    #[test]
    fn handles_unicode_string() {
        // Arrange
        let s = "🦀 crab emoji 🦀";
        let buf = string_to_len_prefixed_buffer(s);

        // Act
        let result = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

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
        // Arrange
        // Create a length-prefixed buffer whose payload bytes are invalid UTF-8.
        let mut v: Vec<u8> = Vec::with_capacity(4 + 2);
        // length = 2 (little endian)
        v.extend_from_slice(&2u32.to_le_bytes());
        // invalid utf8 bytes
        v.extend_from_slice(&[0xffu8, 0xffu8]);

        // Act
        let result = unsafe { len_prefixed_pointer_to_string(v.as_ptr()) };

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
        let large = "x".repeat(10000);
        let buf = string_to_len_prefixed_buffer(&large);

        // Act
        let result = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), large);
    }

    #[test]
    fn header_zero_with_extra_payload_returns_empty() {
        // Arrange: header = 0 but payload exists
        let mut v = Vec::new();
        v.extend_from_slice(&0u32.to_le_bytes());
        v.extend_from_slice(b"extra_payload");

        // Act
        let res = unsafe { len_prefixed_pointer_to_string(v.as_ptr()) };

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "");
    }

    #[test]
    fn very_large_payload_roundtrip() {
        // Arrange: 1 million characters
        let large = "x".repeat(1_000_000);
        let buf = string_to_len_prefixed_buffer(&large);

        // Act
        let res = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap().len(), large.len());
    }

    #[test]
    fn randomish_unicode_roundtrip() {
        // Arrange: build a string with a variety of unicode codepoints
        let parts = ["hello", "🦀", "こんにちは", "مرحبا", "😊", "𐍈"];
        let s = parts.join("-");
        let buf = string_to_len_prefixed_buffer(&s);

        // Act
        let res = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s);
    }

    #[test]
    fn returns_substring_when_header_smaller_than_payload() {
        // Arrange: create a buffer where header=3 but payload contains more bytes
        let mut v = Vec::new();
        v.extend_from_slice(&3u32.to_le_bytes());
        v.extend_from_slice(b"abcdef");

        // Act
        let res = unsafe { len_prefixed_pointer_to_string(v.as_ptr()) };

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "abc");
    }

    #[test]
    fn handles_embedded_nul_bytes() {
        // Arrange
        let s = "a\0b"; // embedded NUL
        let buf = string_to_len_prefixed_buffer(s);

        // Act
        let res = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s.to_string());
    }

    #[test]
    fn handles_control_characters() {
        // Arrange
        let s = "\n\r\t";
        let buf = string_to_len_prefixed_buffer(s);

        // Act
        let res = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

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
        let buf = string_to_len_prefixed_buffer(s);

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
        let buf = string_to_len_prefixed_buffer(s);

        // Act
        let parsed = unsafe { len_prefixed_pointer_to_string(buf.as_ptr()) };

        // Assert
        assert!(parsed.is_ok());
        assert_eq!(parsed.unwrap(), s.to_string());
    }
}
// Following TEST_GUIDE.md conventions for unit testing
