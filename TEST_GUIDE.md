# 🧪 Test Guide

## 📋 Table of Contents

- [Unit Test](#-unit-test)
- [Writing Guidelines](#️-writing-guidelines)
- [Module Rules](#-module-rules)
- [File Naming Rules](#-file-naming-rules)
- [Testing Rules](#-testing-rules)
- [Mock/Stub Usage Rules](#-mockstub-usage-rules)
- [Anti-Patterns to Avoid](#️-anti-patterns-to-avoid)
- [Examples](#-examples)
- [Templates & Helper Snippets](#️-templates--helper-snippets)

---

## 🔬 Unit Test

## ✍️ Writing Guidelines

### 📋 Rules

- All unit tests use the standard Rust `#[test]` attribute
- Each test verifies only a single behavior (no multiple actions)
- Test function names follow `snake_case` in the format `action_condition`

  **Example:** `returns_error_on_invalid_json`

### 🏗️ Structure

- Tests are modularized by feature/function under `#[cfg(test)]` (e.g., `mod serialize`)
- Feature-specific implementation differences are separated using `#[cfg(all(test, feature = "..."))]`
- Module nesting is limited to a maximum of **2 levels** (root module → submodule)

---

## 📁 Module Rules

### 🏠 **Root Modules**

Each root test module is created per target function or feature, with the module name matching the function/feature name.

> **Example:** `mod serialize`

### 📂 **File Placement**

Test file names append `_test.rs` to the target file name and are placed in the same directory as the target code.

> **Example:** `foo.rs` → `foo_test.rs`

### 🔀 **Submodules**

Use only for separating specific scenarios or cases.

> **Examples:** `mod large_inputs`, `mod invalid_length`

- Submodule names must clearly describe the behavior/condition
- Avoid ambiguous names like `edge_cases`
- Nesting is limited to root → sub (maximum 2 levels)

### 🔧 **Common Helpers**

Extract and reuse repetitive setup/assertion code in `tests/helpers.rs` or module-internal helpers.

---

## 📝 File Naming Rules

| Rule               | Format                        | Example                          |
| ------------------ | ----------------------------- | -------------------------------- |
| **Basic**          | `targetfile_test.rs`          | `serialize_test.rs`              |
| **Multiple Files** | `targetfile_scenario_test.rs` | `serialize_large_inputs_test.rs` |

---

## 🎯 Testing Rules

### 🎯 Single Responsibility Principle

- **One Test, One Concept**: Each test should verify exactly one behavior or condition
- **Clear Test Intent**: The test name should clearly indicate what is being tested
- **Isolated Assertions**: Avoid multiple unrelated assertions in a single test

**❌ Bad Example:**

```rust
#[test]
fn test_user_operations() {
    let user = User::new("John");
    assert_eq!(user.name(), "John");           // Testing name
    assert!(user.save().is_ok());             // Testing save
    assert_eq!(user.id(), Some(1));           // Testing ID assignment
}
```

**✅ Good Example:**

```rust
#[test]
fn creates_user_with_correct_name() {
    let user = User::new("John");
    assert_eq!(user.name(), "John");
}

#[test]
fn saves_user_successfully() {
    let user = User::new("John");
    assert!(user.save().is_ok());
}

#[test]
fn assigns_id_after_save() {
    let mut user = User::new("John");
    user.save().unwrap();
    assert!(user.id().is_some());
}
```

### 💡 Core Principles

| Principle                 | Description                                 |
| ------------------------- | ------------------------------------------- |
| **Unit Test Essence**     | Verify internal logic and function behavior |
| **No External Systems**   | Do not test network/DB/OS services directly |
| **No External Libraries** | Use mocks/stubs for external library calls  |

### 📝 Detailed Rules

- **Single Responsibility**: Each `#[test]` verifies a single behavior/condition
- **Explicit Verification**: Use appropriate assertion macros for clear results
- **Reproducibility**: Ensure identical results regardless of execution order
- **Resource Cleanup**: Always include cleanup code for external resources

### 🔍 Assertion Macros Guide

| Macro            | Use Case              | Example                                         |
| ---------------- | --------------------- | ----------------------------------------------- |
| `assert!`        | Boolean conditions    | `assert!(result.is_ok())`                       |
| `assert_eq!`     | Equality comparison   | `assert_eq!(actual, expected)`                  |
| `assert_ne!`     | Inequality comparison | `assert_ne!(result, 0)`                         |
| `matches!`       | Pattern matching      | `assert!(matches!(error, Error::InvalidInput))` |
| `unwrap_err()`   | Error extraction      | `let err = result.unwrap_err()`                 |
| `panic!` testing | Expected panics       | `#[should_panic(expected = "overflow")]`        |

### 🏗️ Test Organization Patterns

**AAA Pattern (Arrange-Act-Assert):**

```rust
#[test]
fn calculates_total_price_with_tax() {
    // Arrange
    let base_price = 100.0;
    let tax_rate = 0.1;
    let calculator = PriceCalculator::new(tax_rate);

    // Act
    let total = calculator.calculate_total(base_price);

    // Assert
    assert_eq!(total, 110.0);
}
```

---

## 🎭 Mock/Stub Usage Rules

> 💡 **When to use:** Only when actual operation cannot be performed due to performance or external dependencies

- Verify actual logic when possible
- Do not test internal logic of external libraries

---

## ⚠️ Anti-Patterns to Avoid

### 🚫 **Test Dependencies**

- Tests should not depend on the execution order of other tests
- Each test should set up its own data and clean up after itself

### 🚫 **Hard-coded Values**

- Avoid magic numbers and hard-coded timeouts
- Use constants or configuration for test values

### 🚫 **Testing Implementation Details**

- Test behavior, not implementation
- Avoid testing private methods directly

### 🚫 **Overly Complex Tests**

- Keep tests simple and focused
- If a test is hard to understand, break it down

**❌ Bad Example:**

```rust
#[test]
fn complex_workflow_test() {
    // Too many responsibilities in one test
    let mut system = System::new();
    system.add_user("Alice");
    system.add_user("Bob");
    assert_eq!(system.user_count(), 2);

    system.process_payments();
    std::thread::sleep(std::time::Duration::from_millis(100)); // Hard-coded delay

    assert!(system.get_user("Alice").unwrap().balance > 0.0);
    // ... more unrelated assertions
}
```

---

## 💻 Examples

### ✅ Successful Serialize Cases

```rust
#[test]
fn serializes_basic_types() {
    assert!(serialize(&42i32).is_ok());
    assert!(serialize(&"test".to_string()).is_ok());
}

#[test]
fn serializes_complex_struct() {
    #[derive(serde::Serialize)]
    struct User {
        id: u32,
        name: String,
        active: bool,
    }

    let user = User {
        id: 1,
        name: "Alice".to_string(),
        active: true,
    };

    let result = serialize(&user);
    assert!(result.is_ok());

    let json = result.unwrap();
    assert!(json.contains("\"id\":1"));
    assert!(json.contains("\"name\":\"Alice\""));
    assert!(json.contains("\"active\":true"));
}
```

### 🔢 Special Value Handling

```rust
#[test]
fn handles_special_floats() {
    #[derive(serde::Serialize)]
    struct WithFloat { v: f64 }

    assert!(serialize(&WithFloat { v: f64::NAN }).is_ok());
    assert!(serialize(&WithFloat { v: f64::INFINITY }).is_ok());
    assert!(serialize(&WithFloat { v: f64::NEG_INFINITY }).is_ok());
}

#[test]
fn handles_edge_case_strings() {
    let test_cases = vec![
        "",                    // Empty string
        "\"",                  // Quote character
        "\\",                  // Backslash
        "\n\r\t",             // Control characters
        "🦀",                  // Unicode
    ];

    for case in test_cases {
        assert!(serialize(&case).is_ok(), "Failed to serialize: {}", case);
    }
}
```

### ❌ Deserialize Error Cases

```rust
#[test]
fn returns_error_on_invalid_json() {
    let err: InternalErrorCode = deserialize::<Vec<i32>>("{invalid}").unwrap_err();
    assert!(matches!(err, InternalErrorCode::InvalidJsonString));
}

#[test]
fn handles_type_mismatch_errors() {
    let json = r#"{"id": "not_a_number"}"#;
    let result = deserialize::<User>(json);

    assert!(result.is_err());
    let error = result.unwrap_err();
    assert!(matches!(error, InternalErrorCode::TypeMismatch));
}

#[test]
#[should_panic(expected = "Unexpected end of input")]
fn panics_on_truncated_json() {
    let truncated_json = r#"{"incomplete": "#;
    deserialize::<serde_json::Value>(truncated_json).unwrap();
}
```

---

## 🛠️ Templates & Helper Snippets

### 📁 `tests/helpers.rs`

```rust
use std::collections::HashMap;

/// Helper function to create large test strings
pub fn make_large_string(size: usize) -> String {
    std::iter::repeat('x').take(size).collect()
}

/// Helper function to assert JSON errors
pub fn assert_json_error<T>(res: Result<T, InternalErrorCode>, kind: InternalErrorCode) {
    assert!(matches!(res.unwrap_err(), k if k == kind));
}

/// Create test user data for consistent testing
pub fn create_test_user(id: u32, name: &str) -> User {
    User {
        id,
        name: name.to_string(),
        email: format!("{}@test.com", name.to_lowercase()),
        created_at: chrono::Utc::now(),
    }
}

/// Creates a test post with optional metadata
pub fn create_test_post(title: &str, author_id: u32) -> Post {
    Post {
        id: rand::random(),
        title: title.to_string(),
        author_id,
        content: format!("Content for {}", title),
        tags: vec!["test".to_string(), "sample".to_string()],
        published: true,
        created_at: chrono::Utc::now(),
    }
}

/// Generates a string of specified length for testing large inputs
pub fn make_large_string(size: usize) -> String {
    "a".repeat(size)
}

/// Creates a deep nested structure for stress testing
pub fn create_nested_object(depth: usize) -> serde_json::Value {
    if depth == 0 {
        return serde_json::json!("leaf");
    }

    serde_json::json!({
        "level": depth,
        "child": create_nested_object(depth - 1)
    })
}

/// Validates JSON structure matches expected schema
pub fn validate_json_structure(json: &serde_json::Value, expected_keys: &[&str]) -> bool {
    if let Some(obj) = json.as_object() {
        expected_keys.iter().all(|key| obj.contains_key(*key))
    } else {
        false
    }
}

/// Setup test database with sample data
pub fn setup_test_data() -> HashMap<u32, User> {
    let mut users = HashMap::new();
    users.insert(1, create_test_user(1, "Alice"));
    users.insert(2, create_test_user(2, "Bob"));
    users.insert(3, create_test_user(3, "Charlie"));
    users
}

/// Test data generator for batch operations
pub fn generate_test_batch(count: usize) -> Vec<User> {
    (0..count)
        .map(|i| create_test_user(i as u32, &format!("User{}", i)))
        .collect()
}

/// Cleanup helper for tests that create temporary files
pub fn cleanup_temp_files(paths: &[&str]) {
    for path in paths {
        let _ = std::fs::remove_file(path);
    }
}

/// Custom assertion for JSON content validation
#[macro_export]
macro_rules! assert_json_contains {
    ($json:expr, $key:expr, $expected:expr) => {
        assert!(
            $json.get($key).is_some(),
            "JSON missing key: {}",
            $key
        );
        assert_eq!(
            $json.get($key).unwrap(),
            &$expected,
            "JSON key '{}' has wrong value",
            $key
        );
    };
}
```

### 📄 `serialize_test.rs` (Structure Example)

```rust
#[cfg(test)]
mod serialize {
    use super::*;
    use crate::tests::helpers::*;

    #[test]
    fn serializes_basic_types() {
        // Test implementation
    }

    #[test]
    fn serializes_with_custom_settings() {
        let settings = SerializeSettings::new()
            .with_pretty_print(true)
            .with_indent(2);

        let data = create_test_user(1, "Test");
        let result = serialize_with_settings(&data, settings);

        assert!(result.is_ok());
        let json = result.unwrap();
        assert!(json.contains("  ")); // Check for indentation
    }

    mod large_inputs {
        use super::*;

        #[test]
        fn handles_10k_string() {
            let large_str = make_large_string(10000);
            assert!(serialize(&large_str).is_ok());
        }

        #[test]
        fn handles_deeply_nested_structure() {
            let mut nested = serde_json::json!({});
            let mut current = &mut nested;

            // Create 100 levels of nesting
            for i in 0..100 {
                current[format!("level_{}", i)] = serde_json::json!({});
                current = &mut current[format!("level_{}", i)];
            }

            assert!(serialize(&nested).is_ok());
        }
    }

    mod error_conditions {
        use super::*;

        #[test]
        fn handles_circular_references() {
            // Test implementation for circular reference detection
        }

        #[test]
        fn handles_memory_pressure() {
            // Test with limited memory scenarios
        }
    }
}
```

---

<div align="center">

**🎉 Happy Testing! 🎉**

_Remember: Good tests make good code!_

</div>
