#[cfg(test)]
mod serialize {
    use crate::errors::InternalErrorCode;
    use crate::utils::json_utils::serialize;

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
        struct WithFloat { v: f64 }

        // Just verify they don't cause errors
        assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(serialize(&WithFloat { v: f64::NEG_INFINITY }).is_ok());
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
    use crate::utils::json_utils::serialize_with_serde_json as serialize;
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
        struct WithFloat { v: f64 }

        // Just verify they don't cause errors
        assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(serialize(&WithFloat { v: f64::NEG_INFINITY }).is_ok());
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
    use crate::utils::json_utils::serialize_with_simd_json as serialize;
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
        struct WithFloat { v: f64 }

        // Just verify they don't cause errors
        assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(serialize(&WithFloat { v: f64::NEG_INFINITY }).is_ok());
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
    use crate::utils::json_utils::deserialize;

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

#[cfg(all(test, not(feature = "simd-json")))]
mod deserialize_with_serde_json {
    use crate::errors::InternalErrorCode;
    use crate::utils::json_utils::deserialize_with_serde_json as deserialize;

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
    use crate::utils::json_utils::deserialize_with_simd_json as deserialize;

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
    use crate::errors::InternalErrorCode;
    use crate::utils::json_utils::to_c_string;
    use std::ffi::CString;

    #[test]
    fn converts_to_c_string_and_round_trips() {
        let value = "valid string ✓ 한글 😊";
        let ptr = to_c_string(value).unwrap();
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round = c_string.into_string().unwrap();
            assert_eq!(round, value);
        }
    }

    #[test]
    fn fails_on_null_byte_in_string() {
        let value = "bad\0string";
        let err = to_c_string(value).unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidCString));
    }

    #[test]
    fn handles_empty_string() {
        let value = "";
        let ptr = to_c_string(value).unwrap();
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round = c_string.into_string().unwrap();
            assert_eq!(round, "");
        }
    }

    #[test]
    fn handles_long_string() {
        let value = "a".repeat(10000);
        let ptr = to_c_string(&value).unwrap();
        unsafe {
            let c_string = CString::from_raw(ptr);
            let round = c_string.into_string().unwrap();
            assert_eq!(round, value);
        }
    }
}

#[cfg(test)]
mod serialize_and_to_c_string {
    use crate::errors::InternalErrorCode;
    use crate::utils::json_utils::serialize_and_to_c_string;
    use std::ffi::CString;

    #[test]
    fn serializes_and_converts_to_c_string() {
        let value = vec!["example", "test"];
        let ptr = serialize_and_to_c_string(&value).unwrap();
        unsafe {
            let c_string = CString::from_raw(ptr);
            let s = c_string.into_string().unwrap();
            assert!(s.contains("example"));
            assert!(s.contains("test"));
        }
    }

    #[test]
    fn handles_special_floats_in_combo() {
        #[derive(serde::Serialize)]
        struct WithFloat { v: f64 }

        // Just verify they don't cause errors
        assert!(serialize_and_to_c_string(&WithFloat { v: f64::NAN }).is_ok());
        assert!(serialize_and_to_c_string(&WithFloat { v: f64::INFINITY }).is_ok());
        assert!(serialize_and_to_c_string(&WithFloat { v: f64::NEG_INFINITY }).is_ok());
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        struct FailingType;
        impl serde::ser::Serialize for FailingType {
            fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
            where
                S: serde::ser::Serializer,
            {
                Err(serde::ser::Error::custom("Serialization failed"))
            }
        }

        let err = serialize_and_to_c_string(&FailingType).unwrap_err();
        assert!(matches!(err, InternalErrorCode::InvalidJsonValue));
    }
}
