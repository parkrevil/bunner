#[cfg(test)]
mod serialize {
    use crate::errors::InternalErrorCode;
    use crate::utils::json::serialize;

    #[test]
    fn serializes_basic_types() {
        // Test basic successful serialization
        assert!(serialize(&42i32).is_ok());
        assert!(serialize(&"test".to_string()).is_ok());
        assert!(serialize(&vec![1, 2, 3]).is_ok());
    }

    #[test]
    fn handles_special_floats() {
        #[derive(serde::Serialize)]
        struct WithFloat {
            v: f64,
        }

        // Just verify they don't cause errors
        assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(
            serialize(&WithFloat {
                v: f64::NEG_INFINITY
            })
            .is_ok()
        );
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        // Custom type that always fails serialization
        struct FailingType;
        impl serde::ser::Serialize for FailingType {
            fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::ser::Serializer,
            {
                Err(serde::ser::Error::custom("Serialization failed"))
            }
        }

        let err = serialize(&FailingType).unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonValue));
    }
}

#[cfg(all(test, not(feature = "simd-json")))]
mod serialize_with_serde_json {
    use crate::errors::InternalErrorCode;
    use crate::utils::json::serialize_with_serde_json as serialize;
    use serde::ser::{Serialize, Serializer};

    #[test]
    fn serializes_basic_types() {
        // Test basic successful serialization
        assert!(serialize(&42i32).is_ok());
        assert!(serialize(&"test".to_string()).is_ok());
        assert!(serialize(&vec![1, 2, 3]).is_ok());
    }

    #[test]
    fn handles_special_floats() {
        #[derive(serde::Serialize)]
        struct WithFloat {
            v: f64,
        }

        // Just verify they don't cause errors
        assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(
            serialize(&WithFloat {
                v: f64::NEG_INFINITY
            })
            .is_ok()
        );
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        struct FailingType;
        impl Serialize for FailingType {
            fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
            where
                S: Serializer,
            {
                Err(serde::ser::Error::custom("Serialization failed"))
            }
        }

        let err = serialize(&FailingType).unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonValue));
    }
}

#[cfg(all(test, feature = "simd-json"))]
mod serialize_with_simd_json {
    use crate::errors::InternalErrorCode;
    use crate::utils::json::serialize_with_simd_json as serialize;
    use serde::ser::{Serialize, Serializer};

    #[test]
    fn serializes_basic_types() {
        // Test basic successful serialization
        assert!(serialize(&42i32).is_ok());
        assert!(serialize(&"test".to_string()).is_ok());
        assert!(serialize(&vec![1, 2, 3]).is_ok());
    }

    #[test]
    fn handles_special_floats() {
        #[derive(serde::Serialize)]
        struct WithFloat {
            v: f64,
        }

        // Just verify they don't cause errors
        assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(
            serialize(&WithFloat {
                v: f64::NEG_INFINITY
            })
            .is_ok()
        );
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        struct FailingType;
        impl Serialize for FailingType {
            fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
            where
                S: Serializer,
            {
                Err(serde::ser::Error::custom("Serialization failed"))
            }
        }

        let err = serialize(&FailingType).unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonValue));
    }
}

#[cfg(test)]
mod deserialize {
    use crate::errors::InternalErrorCode;
    use crate::utils::json::deserialize;

    #[test]
    fn deserializes_basic_types() {
        // Test basic successful deserialization
        let result: Result<Vec<i32>, _> = deserialize("[1,2,3]");
        assert!(result.is_ok());

        let result: Result<String, _> = deserialize("\"test\"");
        assert!(result.is_ok());
    }

    #[test]
    fn returns_error_on_invalid_json() {
        let err: InternalErrorCode = deserialize::<Vec<i32>>("{invalid_json}").unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonString));
    }

    #[test]
    fn returns_error_on_type_mismatch() {
        #[derive(serde::Deserialize, Debug, PartialEq)]
        struct Point {
            _x: i32,
            _y: i32,
        }

        let result = deserialize::<Point>("[1, 2, 3]");

        #[cfg(not(feature = "simd-json"))]
        {
            let err = result.unwrap_err();
            assert!(matches!(err, InternalErrorCode::InvalidJsonString));
        }

        #[cfg(feature = "simd-json")]
        {
            let point = result.unwrap();
            assert_eq!(point, Point { _x: 1, _y: 2 });
        }
    }
}

#[cfg(all(test, not(feature = "simd-json")))]
mod deserialize_with_serde_json {
    use crate::errors::InternalErrorCode;
    use crate::utils::json::deserialize_with_serde_json as deserialize;

    #[test]
    fn deserializes_basic_types() {
        // Test basic successful deserialization
        let result: Result<Vec<i32>, _> = deserialize("[1,2,3]");
        assert!(result.is_ok());

        let result: Result<String, _> = deserialize("\"test\"");
        assert!(result.is_ok());
    }

    #[test]
    fn returns_error_on_invalid_json() {
        let err: InternalErrorCode = deserialize::<Vec<i32>>("{invalid_json}").unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonString));
    }
}

#[cfg(all(test, feature = "simd-json"))]
mod deserialize_with_simd_json {
    use crate::errors::InternalErrorCode;
    use crate::utils::json::deserialize_with_simd_json as deserialize;

    #[test]
    fn deserializes_basic_types() {
        // Test basic successful deserialization
        let result: Result<Vec<i32>, _> = deserialize("[1,2,3]");
        assert!(result.is_ok());

        let result: Result<String, _> = deserialize("\"test\"");
        assert!(result.is_ok());
    }

    #[test]
    fn returns_error_on_invalid_json() {
        let err: InternalErrorCode = deserialize::<Vec<i32>>("{invalid_json}").unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonString));
    }
}

#[cfg(test)]
mod to_c_string {
    use crate::utils::json::to_c_string;
    use std::ffi::CString;

    #[test]
    fn converts_to_c_string_and_round_trips() {
        let value = "valid string ✓ 한글 😊";
        let ptr = to_c_string(value);
        assert!(
            !ptr.is_null(),
            "Pointer should not be null for valid string"
        );

        // SAFETY: The pointer is not null and was created from a valid string,
        // so it's safe to convert back. We are also taking ownership.
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round_trip = c_string.into_string().unwrap();
            assert_eq!(round_trip, value);
        }
    }

    #[test]
    fn returns_null_on_null_byte_in_string() {
        let value = "bad\0string";
        let ptr = to_c_string(value);
        assert!(
            ptr.is_null(),
            "Pointer should be null for string with null byte"
        );
    }

    #[test]
    fn handles_empty_string() {
        let value = "";
        let ptr = to_c_string(value);
        assert!(
            !ptr.is_null(),
            "Pointer should not be null for an empty string"
        );

        // SAFETY: The pointer is not null and was created from an empty string.
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round_trip = c_string.into_string().unwrap();
            assert_eq!(round_trip, "");
        }
    }

    #[test]
    fn handles_long_string() {
        let value = "a".repeat(10000);
        let ptr = to_c_string(&value);
        assert!(
            !ptr.is_null(),
            "Pointer should not be null for a long string"
        );

        // SAFETY: The pointer is not null and was created from a long string.
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round_trip = c_string.into_string().unwrap();
            assert_eq!(round_trip, value);
        }
    }
}

#[cfg(test)]
mod serialize_and_to_c_string {
    use crate::utils::json::serialize_and_to_c_string;
    use std::ffi::CString;

    #[test]
    fn serializes_and_converts_to_c_string() {
        let value = vec!["example", "test"];
        let ptr = serialize_and_to_c_string(&value);
        assert!(
            !ptr.is_null(),
            "Pointer should not be null for valid serialization"
        );

        // SAFETY: The pointer is not null and comes from a successful serialization.
        unsafe {
            let c_string = CString::from_raw(ptr);
            let s = c_string.into_string().unwrap();
            assert!(s.contains("example"));
            assert!(s.contains("test"));
        }
    }

    #[test]
    fn handles_special_floats() {
        #[derive(serde::Serialize)]
        struct WithFloat {
            v: f64,
        }

        // Just verify they don't cause errors and produce non-null pointers
        let ptr_nan = serialize_and_to_c_string(&WithFloat { v: f64::NAN });
        assert!(!ptr_nan.is_null());
        let ptr_inf = serialize_and_to_c_string(&WithFloat { v: f64::INFINITY });
        assert!(!ptr_inf.is_null());
        let ptr_neg_inf = serialize_and_to_c_string(&WithFloat {
            v: f64::NEG_INFINITY,
        });
        assert!(!ptr_neg_inf.is_null());

        // SAFETY: Clean up the allocated memory to prevent leaks in tests.
        unsafe {
            if !ptr_nan.is_null() {
                let _ = CString::from_raw(ptr_nan);
            }
            if !ptr_inf.is_null() {
                let _ = CString::from_raw(ptr_inf);
            }
            if !ptr_neg_inf.is_null() {
                let _ = CString::from_raw(ptr_neg_inf);
            }
        }
    }

    #[test]
    fn returns_null_on_serialization_failure() {
        struct FailingType;
        impl serde::ser::Serialize for FailingType {
            fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::ser::Serializer,
            {
                Err(serde::ser::Error::custom("Serialization failed"))
            }
        }

        let ptr = serialize_and_to_c_string(&FailingType);
        assert!(
            ptr.is_null(),
            "Pointer should be null on serialization failure"
        );
    }

    #[test]
    fn safely_handles_serializing_string_with_null_byte() {
        // This tests that a string containing a null byte is properly escaped
        // by serde_json (e.g., to `\u0000`) and can be safely converted to a CString.
        let data_with_null = vec!["value\0"];
        let ptr = serialize_and_to_c_string(&data_with_null);

        assert!(
            !ptr.is_null(),
            "Pointer should not be null for a string with an escaped null byte"
        );

        // SAFETY: The pointer is not null and was created from a valid serialization.
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round_trip = c_string.into_string().unwrap();
            // Check that the null byte was escaped to \u0000
            assert_eq!(round_trip, r#"["value\u0000"]"#);
        }
    }
}
