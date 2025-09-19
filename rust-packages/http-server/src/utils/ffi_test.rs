#[cfg(test)]
mod make_result {
    use crate::test_utils::registry as test_registry;
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

        let _ = unsafe { test_registry::read_string_and_free(p) };
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
mod read_length_at_pointer {
    use crate::test_utils::string::make_len_prefixed_buf;
    use crate::utils::ffi::read_length_at_pointer;

    #[test]
    fn reads_length_correctly() {
        let buf = make_len_prefixed_buf("hello");
        let ptr = buf.as_ptr();

        let len = unsafe { read_length_at_pointer(ptr) }.unwrap();

        assert_eq!(len, 5);
    }

    #[test]
    fn returns_error_on_null_pointer() {
        let res = unsafe { read_length_at_pointer(std::ptr::null()) };

        assert!(res.is_err());
    }
}

#[cfg(test)]
mod take_len_prefixed_pointer {
    use crate::enums::LenPrefixedString;
    use crate::test_utils::string::{make_large_string, make_len_prefixed_buf};
    use crate::utils::ffi::take_len_prefixed_pointer;
    use std::mem;

    #[test]
    fn returns_text_variant_for_small_payload() {
        let buf = make_len_prefixed_buf("small");
        let ptr = buf.as_ptr();

        let res = unsafe { take_len_prefixed_pointer(ptr, 1024) }.unwrap();

        if let LenPrefixedString::Text(s) = res {
            assert_eq!(s, "small");
        } else {
            unreachable!("expected Text variant");
        }
    }

    #[test]
    fn returns_bytes_variant_for_large_payload_and_preserves_content() {
        let large = make_large_string(5000);
        let mut buf = make_len_prefixed_buf(&large);

        // relinquish ownership to simulate caller giving Rust the allocation
        let ptr = buf.as_mut_ptr();
        let _len = buf.len();
        let _cap = buf.capacity();
        mem::forget(buf);

        let res = unsafe { take_len_prefixed_pointer(ptr, 1024) }.unwrap();

        if let LenPrefixedString::Bytes(v) = res {
            let payload = String::from_utf8(v).expect("payload should be utf8");
            assert_eq!(payload, large);
        } else {
            unreachable!("expected Bytes variant");
        }
    }

    #[test]
    fn boundary_threshold_equal_returns_text() {
        let s = "a".repeat(1024);
        let buf = make_len_prefixed_buf(&s);
        let ptr = buf.as_ptr();

        let res = unsafe { take_len_prefixed_pointer(ptr, 1024) }.unwrap();

        if let LenPrefixedString::Text(t) = res {
            assert_eq!(t.len(), 1024);
        } else {
            unreachable!("expected Text variant at threshold==")
        }
    }

    #[test]
    fn boundary_threshold_plus_one_returns_bytes() {
        let s = "b".repeat(1025);
        let mut buf = make_len_prefixed_buf(&s);
        let ptr = buf.as_mut_ptr();
        std::mem::forget(buf);

        let res = unsafe { take_len_prefixed_pointer(ptr, 1024) }.unwrap();

        if let LenPrefixedString::Bytes(v) = res {
            let payload = String::from_utf8(v).expect("payload should be utf8");
            assert_eq!(payload.len(), 1025);
        } else {
            unreachable!("expected Bytes variant at threshold+1")
        }
    }

    #[test]
    fn zero_length_payload_returns_empty_text() {
        let buf = make_len_prefixed_buf("");
        let ptr = buf.as_ptr();

        let res = unsafe { take_len_prefixed_pointer(ptr, 1024) }.unwrap();

        if let LenPrefixedString::Text(t) = res {
            assert_eq!(t, "");
        } else {
            unreachable!("expected Text variant for zero-length")
        }
    }

    #[test]
    fn take_len_prefixed_pointer_null_pointer_returns_error() {
        let res = unsafe { take_len_prefixed_pointer(std::ptr::null(), 1024) };

        assert!(res.is_err());
    }
}

#[cfg(test)]
mod deserialize_json_pointer_tests {
    use crate::test_utils::string::{make_large_string, make_len_prefixed_buf};
    use crate::utils::ffi::deserialize_json_pointer;
    use serde_json::Value;
    use std::collections::HashMap;

    #[test]
    fn deserializes_small_text_payload() {
        // JSON payload small enough to be Text variant
        let json = "[1,2,3]";
        let buf = make_len_prefixed_buf(json);

        let res: Result<Vec<i32>, _> = unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn deserializes_large_bytes_payload() {
        // Create a large JSON string to force Bytes variant
        let large = make_large_string(5000);
        let json = format!("\"{}\"", large); // a JSON string containing the large payload
        let mut buf = make_len_prefixed_buf(&json);

        // relinquish ownership to simulate caller giving Rust the allocation
        let ptr = buf.as_mut_ptr();
        let _len = buf.len();
        let _cap = buf.capacity();
        std::mem::forget(buf);

        let res: Result<String, _> = unsafe { deserialize_json_pointer(ptr) };

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), large);

        // cleanup is handled in test registry helper when needed
    }

    #[test]
    fn returns_error_on_invalid_json() {
        let buf = make_len_prefixed_buf("{invalid_json}");

        let res: Result<Vec<i32>, _> = unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_err());
    }

    #[test]
    fn deserializes_empty_array() {
        let buf = make_len_prefixed_buf("[]");

        let res: Result<Vec<i32>, _> = unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_ok());
        assert_eq!(res.unwrap().len(), 0);
    }

    #[test]
    fn deserializes_object_to_map() {
        let json = "{\"a\":1,\"b\":\"x\"}";
        let buf = make_len_prefixed_buf(json);

        let res: Result<HashMap<String, Value>, _> =
            unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_ok());
        let map = res.unwrap();
        assert_eq!(map.get("a").and_then(Value::as_i64), Some(1));
        assert_eq!(map.get("b").and_then(Value::as_str), Some("x"));
    }

    #[test]
    fn deserializes_bool_and_null() {
        let buf_true = make_len_prefixed_buf("true");
        let res_bool: Result<bool, _> = unsafe { deserialize_json_pointer(buf_true.as_ptr()) };
        assert!(res_bool.is_ok());
        assert!(res_bool.unwrap());

        let buf_null = make_len_prefixed_buf("null");
        let res_opt: Result<Option<String>, _> =
            unsafe { deserialize_json_pointer(buf_null.as_ptr()) };
        assert!(res_opt.is_ok());
        assert!(res_opt.unwrap().is_none());
    }

    #[test]
    fn type_mismatch_returns_error() {
        // Attempt to parse an array as a string -> should error
        let buf = make_len_prefixed_buf("[1,2,3]");

        let res: Result<String, _> = unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_err());
    }

    #[test]
    fn deserializes_with_whitespace() {
        let buf = make_len_prefixed_buf("  [1, 2] \n");

        let res: Result<Vec<i32>, _> = unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), vec![1, 2]);
    }

    #[test]
    fn deserializes_nested_structures() {
        let json = "[{\"x\":[1,{\"y\":2}]}]";
        let buf = make_len_prefixed_buf(json);

        let res: Result<Vec<Value>, _> = unsafe { deserialize_json_pointer(buf.as_ptr()) };

        assert!(res.is_ok());
        let v = res.unwrap();
        assert_eq!(v.len(), 1);
        let obj = &v[0];
        let arr = obj
            .get("x")
            .and_then(Value::as_array)
            .expect("x should be array");
        assert_eq!(arr[0].as_i64(), Some(1));
        assert_eq!(arr[1].get("y").and_then(Value::as_i64), Some(2));
    }
}
