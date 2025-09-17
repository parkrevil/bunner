use serde::Serialize;

/// A type whose Serialize intentionally fails to exercise error paths.
pub struct FailingType;

impl Serialize for FailingType {
    fn serialize<S>(&self, _serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        Err(serde::ser::Error::custom("intentional serialize failure"))
    }
}
