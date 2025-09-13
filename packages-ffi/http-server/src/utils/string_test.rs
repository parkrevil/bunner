// Following TEST_GUIDE.md conventions for unit testing
use super::string::{cstr_to_str, free_string};
use std::{ffi::CString, os::raw::c_char, ptr};

#[cfg(test)]
mod cstr_to_str {
    use super::*;

    #[test]
    fn converts_valid_c_string_to_rust_str() {
        // Arrange
        let test_string = "Hello, World!";
        let c_string = CString::new(test_string).unwrap();
        let c_ptr = c_string.as_ptr();

        // Act
        let result = unsafe { cstr_to_str(c_ptr) };

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), test_string);
    }

    #[test]
    fn converts_empty_c_string_to_empty_str() {
        // Arrange
        let c_string = CString::new("").unwrap();
        let c_ptr = c_string.as_ptr();

        // Act
        let result = unsafe { cstr_to_str(c_ptr) };

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "");
    }

    #[test]
    fn converts_unicode_c_string_correctly() {
        // Arrange
        let test_string = "Hello 🦀 Rust!";
        let c_string = CString::new(test_string).unwrap();
        let c_ptr = c_string.as_ptr();

        // Act
        let result = unsafe { cstr_to_str(c_ptr) };

        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), test_string);
    }

    #[test]
    fn handles_special_characters() {
        // Arrange
        let test_cases = vec![
            "tabs\tand\nnewlines",
            "quotes\"and'apostrophes",
            "numbers123and!@#symbols",
        ];

        for test_string in test_cases {
            // Arrange
            let c_string = CString::new(test_string).unwrap();
            let c_ptr = c_string.as_ptr();

            // Act
            let result = unsafe { cstr_to_str(c_ptr) };

            // Assert
            assert!(result.is_ok(), "Failed to convert: {}", test_string);
            assert_eq!(result.unwrap(), test_string);
        }
    }

    #[test]
    fn returns_error_for_invalid_utf8() {
        // Arrange
        // Create a C string with invalid UTF-8 bytes
        let invalid_bytes = [0xFF, 0xFE, 0x00]; // Invalid UTF-8 sequence + null terminator
        let c_ptr = invalid_bytes.as_ptr() as *const c_char;

        // Act
        let result = unsafe { cstr_to_str(c_ptr) };

        // Assert
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), std::str::Utf8Error { .. }));
    }

    mod edge_cases {
        use super::*;

        #[test]
        fn handles_long_strings() {
            // Arrange
            let long_string = "a".repeat(10000);
            let c_string = CString::new(long_string.clone()).unwrap();
            let c_ptr = c_string.as_ptr();

            // Act
            let result = unsafe { cstr_to_str(c_ptr) };

            // Assert
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), long_string);
        }

        #[test]
        fn handles_string_with_null_bytes_in_middle() {
            // Arrange - CString::new will fail with null bytes in middle
            let result = CString::new("hello\0world");

            // Assert
            assert!(result.is_err());
        }

        #[test]
        fn handles_ascii_control_characters() {
            // Arrange
            let control_chars = "\x01\x02\x03\x1F"; // ASCII control characters
            let c_string = CString::new(control_chars).unwrap();
            let c_ptr = c_string.as_ptr();

            // Act
            let result = unsafe { cstr_to_str(c_ptr) };

            // Assert
            assert!(result.is_ok());
            assert_eq!(result.unwrap(), control_chars);
        }

        #[test]
        fn handles_maximum_length_strings() {
            // Arrange - Test with very large string (1MB)
            let large_string = "x".repeat(1_000_000);
            let c_string = CString::new(large_string.clone()).unwrap();
            let c_ptr = c_string.as_ptr();

            // Act
            let result = unsafe { cstr_to_str(c_ptr) };

            // Assert
            assert!(result.is_ok());
            assert_eq!(result.unwrap().len(), 1_000_000);
        }
    }
}

#[cfg(test)]
mod free_string {
    use super::*;

    #[test]
    fn safely_frees_valid_c_string() {
        // Arrange
        let test_string = "Test string for freeing";
        let c_string = CString::new(test_string).unwrap();
        let c_ptr = c_string.into_raw(); // Transfer ownership

        // Act - should not panic or crash
        unsafe { free_string(c_ptr) };

        // Assert - function completed without panic
    }

    #[test]
    fn safely_handles_null_pointer() {
        // Arrange
        let null_ptr = ptr::null_mut();

        // Act - should not panic or crash
        unsafe { free_string(null_ptr) };

        // Assert - function completed without panic
    }

    #[test]
    fn frees_empty_string() {
        // Arrange
        let c_string = CString::new("").unwrap();
        let c_ptr = c_string.into_raw();

        // Act
        unsafe { free_string(c_ptr) };

        // Assert - function completed without panic
    }

    #[test]
    fn frees_unicode_string() {
        // Arrange
        let unicode_string = "🦀 Rust is awesome! 🚀";
        let c_string = CString::new(unicode_string).unwrap();
        let c_ptr = c_string.into_raw();

        // Act
        unsafe { free_string(c_ptr) };

        // Assert - function completed without panic
    }

    mod memory_safety {
        use super::*;

        #[test]
        fn frees_large_string() {
            // Arrange
            let large_string = "x".repeat(100000);
            let c_string = CString::new(large_string).unwrap();
            let c_ptr = c_string.into_raw();

            // Act
            unsafe { free_string(c_ptr) };

            // Assert - function completed without panic
        }
    }
}
