// Clean TEST_GUIDE-compliant tests for `string` utilities

use crate::test_utils::pointer::with_raw_ptr;
use crate::test_utils::string::{make_len_prefixed_buf, make_mismatched_len_buf};
use crate::utils::string::{len_prefixed_pointer_to_string, string_to_len_prefixed_buffer};
use crate::types::LengthHeaderSize;
use crate::constants::LENGTH_HEADER_BYTES;
use crate::test_utils::string::extract_len_header;

#[cfg(test)]
mod len_prefixed_pointer_to_string_tests {
    use super::*;

    #[test]
    fn reads_valid_utf8_payload() {
        let s = "hello world";
        let buf = make_len_prefixed_buf(s);

        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s.to_string());
    }

    #[test]
    fn returns_error_on_null_pointer() {
        let res = unsafe { len_prefixed_pointer_to_string(std::ptr::null()) };

        assert!(res.is_err());
    }

    #[test]
    fn reads_only_header_length_when_header_smaller_than_payload() {
        let payload = b"abcdef".as_ref();
        let buf = make_mismatched_len_buf(2, payload);

        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        assert!(res.is_ok());
        let out = res.unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out.as_bytes(), &payload[..2]);
    }

    #[test]
    fn handles_embedded_nul_bytes() {
        let s = "a\0b";
        let buf = make_len_prefixed_buf(s);

        let res = with_raw_ptr(&buf, |p| unsafe { len_prefixed_pointer_to_string(p) });

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s.to_string());
    }
}

#[cfg(test)]
mod string_to_len_prefixed_buffer_tests {
    use super::*;

    #[test]
    fn buffer_contains_header_and_payload() {
        let s = "abc";
        let v = string_to_len_prefixed_buffer(s);

    let header = extract_len_header(&v) as LengthHeaderSize;
    assert_eq!(header, 3);

    let payload = &v[LENGTH_HEADER_BYTES..];
        assert_eq!(payload, b"abc");
    }

    #[test]
    fn empty_string_has_zero_header_and_no_payload() {
        let v = string_to_len_prefixed_buffer("");
    let header = extract_len_header(&v) as LengthHeaderSize;

    assert_eq!(header, 0);
    assert_eq!(v.len(), LENGTH_HEADER_BYTES);
    }

    #[test]
    fn roundtrip_via_len_prefixed_buffer() {
        let s = "roundtrip test";
        let v = string_to_len_prefixed_buffer(s);

        let res = with_raw_ptr(&v, |p| unsafe { len_prefixed_pointer_to_string(p) });

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), s.to_string());
    }
}
