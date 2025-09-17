#[cfg(test)]
mod make_string_pointer {
    use crate::pointer_registry;

    #[test]
    fn returns_pointer_when_called() {
        // Arrange
        let s = "unit-test-str";

        // Act
        let p = crate::utils::ffi::make_string_pointer(s);

        // Assert
        assert!(!p.is_null());

        // Cleanup - read and free via test helper
        let _ = unsafe { crate::test_utils::registry::read_string_and_free(p) };
    }

    #[test]
    fn registers_pointer_in_registry() {
        let s = "register-check";
        let p = crate::utils::ffi::make_string_pointer(s);
        assert!(pointer_registry::has(p));
        let _ = unsafe { crate::test_utils::registry::read_string_and_free(p) };
    }

    #[test]
    fn roundtrip_returns_same_string() {
        let s = "roundtrip-✓-テスト";
        let p = crate::utils::ffi::make_string_pointer(s);
        let parsed = unsafe { crate::test_utils::registry::read_string_and_free(p) }.unwrap();
        assert_eq!(parsed, s.to_string());
    }

    #[test]
    fn handles_embedded_nul() {
        let s = "a\0b";
        let p = crate::utils::ffi::make_string_pointer(s);
        let parsed = unsafe { crate::test_utils::registry::read_string_and_free(p) }.unwrap();
        assert_eq!(parsed, s.to_string());
    }

    #[test]
    fn double_free_is_noop() {
        let s = "double-free";
        let p = crate::utils::ffi::make_string_pointer(s);
        // first free: keep to test double-free behavior
        unsafe { pointer_registry::free(p) };
        // second free must not panic and registry should not contain pointer
        unsafe { pointer_registry::free(p) };
        assert!(!pointer_registry::has(p));
    }

    #[test]
    fn concurrent_registration_registers_and_frees() {
        use std::thread;

        let mut handles = Vec::new();
        for i in 0..8 {
            handles.push(thread::spawn(move || {
                let s = format!("concurrent-{}", i);
                let p = crate::utils::ffi::make_string_pointer(&s);
                assert!(!p.is_null());
                let parsed =
                    unsafe { crate::test_utils::registry::read_string_and_free(p) }.unwrap();
                assert_eq!(parsed, s);
            }));
        }

        for h in handles {
            let _ = h.join();
        }
    }
}

#[cfg(test)]
mod make_result {
    use crate::utils::ffi::make_result;
    use crate::utils::string::len_prefixed_pointer_to_string;

    #[test]
    fn serializes_value_and_registers_pointer() {
        let data = vec![10, 20, 30];
        let p = make_result(&data);
        assert!(!p.is_null());

        // ensure payload is a len-prefixed JSON string
        let s = unsafe { len_prefixed_pointer_to_string(p) }.unwrap();
        assert!(s.contains("10") && s.contains("20") && s.contains("30"));

        let _ = unsafe { crate::test_utils::registry::read_string_and_free(p) };
    }

    #[test]
    fn returns_null_on_serialization_failure() {
        // Use the test helper FailingType which serializes to error
        use crate::test_utils::json::FailingType;

        let p = make_result(&FailingType);
        assert!(p.is_null());
    }
}

#[cfg(test)]
mod parse_json_pointer {
    use crate::errors::internal_error::InternalErrorCode;
    use crate::test_utils::registry::with_registered_vec;
    use crate::test_utils::string::{make_invalid_utf8_buf, make_large_string};
    use crate::utils::ffi::parse_json_pointer;

    #[test]
    fn returns_error_on_null_pointer() {
        let res: Result<String, _> = unsafe { parse_json_pointer(std::ptr::null()) };
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), InternalErrorCode::PointerIsNull));
    }

    #[test]
    fn parses_valid_json_from_pointer() {
        let buf = crate::test_utils::string::make_len_prefixed_buf("\"hello\""); // JSON string: "hello"
        with_registered_vec(buf, |p| {
            let res: Result<String, _> = unsafe { parse_json_pointer(p) };
            assert!(res.is_ok());
            assert_eq!(res.unwrap(), "hello".to_string());
        });
    }

    #[test]
    fn returns_error_on_invalid_utf8() {
        let buf = make_invalid_utf8_buf(4);
        with_registered_vec(buf, |p| {
            let res: Result<String, _> = unsafe { parse_json_pointer(p) };
            assert!(res.is_err());
            assert!(matches!(
                res.unwrap_err(),
                InternalErrorCode::InvalidJsonString
            ));
        });
    }

    #[test]
    fn large_payload_roundtrip() {
        // Build a large JSON string payload
        let large = make_large_string(200_000);
        let json = format!("\"{}\"", large);
        crate::test_utils::registry::with_registered_parsed::<String, _, _>(&json, |res| {
            assert!(res.is_ok());
            assert_eq!(res.unwrap().len(), large.len());
        });
    }

    #[test]
    fn typed_roundtrip_vec_i32() {
        // Test parsing into a concrete type
        let json = "[1,2,3,4]".to_string();
        crate::test_utils::registry::with_registered_parsed::<Vec<i32>, _, _>(&json, |res| {
            assert!(res.is_ok());
            assert_eq!(res.unwrap(), vec![1, 2, 3, 4]);
        });
    }

    #[test]
    fn returns_error_on_type_mismatch() {
        // JSON is an array, but request parsing expects an object/struct
        let json = "[1,2,3]".to_string();
        crate::test_utils::registry::with_registered_parsed::<
            std::collections::HashMap<String, i32>,
            _,
            _,
        >(&json, |res| {
            assert!(res.is_err());
        });
    }

    #[test]
    fn concurrent_register_and_parse() {
        use std::thread;

        let threads = 8usize;
        let mut handles = Vec::new();

        for i in 0..threads {
            let json = format!("[{}]", i);
            handles.push(thread::spawn(move || {
                crate::test_utils::registry::with_registered_parsed::<Vec<i32>, _, _>(
                    &json,
                    |res| {
                        assert!(res.is_ok());
                    },
                );
            }));
        }

        for h in handles {
            let _ = h.join();
        }
    }
}
