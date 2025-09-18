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
