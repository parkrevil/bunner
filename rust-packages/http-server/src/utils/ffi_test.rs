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
