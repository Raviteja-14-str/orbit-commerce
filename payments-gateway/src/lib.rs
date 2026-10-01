// Synthetic demo code for Nexus Intelligence. Not a real system.

//! payments-gateway 3.40.0 risk scoring.
//! The preallocated feature cap and the unwrap on TooManyFeatures arrive in 3.41.0.

pub const TRACE_AUTHORIZE: &str = "payments.authorize";
pub const TRACE_RISK: &str = "risk.score";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeatureTable {
    pub features: usize,
}

impl FeatureTable {
    pub fn load(count: usize) -> Result<Self, String> {
        if count == 0 {
            return Err("empty feature file".to_string());
        }
        Ok(FeatureTable { features: count })
    }
}

pub fn authorize(feature_count: usize) -> Result<&'static str, String> {
    FeatureTable::load(feature_count).map(|_| "approved")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_a_normal_feature_file() {
        let table = FeatureTable::load(189).unwrap();
        assert_eq!(table.features, 189);
        assert_eq!(authorize(189).unwrap(), "approved");
    }
}
