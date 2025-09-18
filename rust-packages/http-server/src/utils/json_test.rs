#[cfg(test)]
mod serialize {
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
        assert!(serialize(&WithFloat {
            v: f64::NEG_INFINITY
        })
        .is_ok());
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        use crate::test_utils::json::FailingType;

        let err = serialize(&FailingType).unwrap_err();
        assert!(!err.is_empty());
    }
}

#[cfg(all(test, not(feature = "simd-json")))]
mod serialize_with_serde_json {
    use crate::utils::json::serialize_with_serde_json as serialize;

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
        assert!(serialize(&WithFloat {
            v: f64::NEG_INFINITY
        })
        .is_ok());
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        use crate::test_utils::json::FailingType;

        let err = serialize(&FailingType).unwrap_err();
        assert!(!err.is_empty());
    }
}

#[cfg(all(test, feature = "simd-json"))]
mod serialize_with_simd_json {
    use crate::utils::json::serialize_with_simd_json as serialize;

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
        assert!(serialize(&WithFloat {
            v: f64::NEG_INFINITY
        })
        .is_ok());
    }

    #[test]
    fn returns_error_on_serialization_failure() {
        use crate::test_utils::json::FailingType;

        let err = serialize(&FailingType).unwrap_err();
        assert!(!err.is_empty());
    }
}

#[cfg(test)]
mod deserialize {
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
        let err = deserialize::<Vec<i32>>("{invalid_json}").unwrap_err();
        assert!(!err.is_empty());
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
            assert!(!err.is_empty());
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
        let err = deserialize::<Vec<i32>>("{invalid_json}").unwrap_err();
        assert!(!err.is_empty());
    }
}

#[cfg(all(test, feature = "simd-json"))]
mod deserialize_with_simd_json {
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
        let err = deserialize::<Vec<i32>>("{invalid_json}").unwrap_err();
        assert!(!err.is_empty());
    }
}
