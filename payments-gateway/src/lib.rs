// Synthetic demo code for Nexus Intelligence. Not a real system.

//! payments-gateway 3.41.0 risk scoring.
//! The feature table is preallocated for 200 columns. FeatureTable::load returns
//! TooManyFeatures above that, and the loader thread unwraps the error.
//! Heap and acquirer health are not involved. POST /v1/authorizations becomes 500.

pub const TRACE_AUTHORIZE: &str = "payments.authorize";
pub const TRACE_RISK: &str = "risk.score";
pub const PREALLOCATED_LIMIT: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TooManyFeatures {
    pub count: usize,
    pub limit: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeatureTable {
    pub features: usize,
}

impl FeatureTable {
    pub fn load(count: usize) -> Result<Self, TooManyFeatures> {
        if count > PREALLOCATED_LIMIT {
            return Err(TooManyFeatures {
                count,
                limit: PREALLOCATED_LIMIT,
            });
        }
        Ok(FeatureTable { features: count })
    }
}

pub fn format_risk_panic(ts: &str, thread: &str, count: usize) -> String {
    format!(
        "{ts} ERROR risk-scoring thread={thread} PANIC: feature count {count} exceeds preallocated limit {limit} (FeatureTable::load) - called unwrap() on Err(TooManyFeatures)",
        limit = PREALLOCATED_LIMIT
    )
}

pub fn format_loaded(ts: &str, gen: u64, features: usize, size_kb: f64) -> String {
    format!("{ts} INFO  risk-scoring loaded feature file gen={gen} features={features} size={size_kb:.1}KB")
}

pub fn format_http_panic(ts: &str, trace_id: &str) -> String {
    format!("{ts} ERROR http 500 POST /v1/authorizations trace_id={trace_id} trace=risk.score -> panic")
}

/// Loader thread. TooManyFeatures is not handled: the Result is unwrap()'d.
pub fn score(count: usize) -> FeatureTable {
    FeatureTable::load(count).unwrap()
}

pub struct AuthResponse {
    pub status: u16,
    pub logs: Vec<String>,
}

/// POST /v1/authorizations. A risk panic is a 500. The acquirer is not called.
pub fn authorize(ts: &str, trace_id: &str, feature_count: usize, size_kb: f64, gen: u64) -> AuthResponse {
    match FeatureTable::load(feature_count) {
        Ok(table) => AuthResponse {
            status: 200,
            logs: vec![format_loaded(ts, gen, table.features, size_kb)],
        },
        Err(_err) => {
            // Same failure score() hits by calling unwrap() on Err(TooManyFeatures).
            AuthResponse {
                status: 500,
                logs: vec![
                    format_risk_panic(ts, "loader-2", feature_count),
                    format_http_panic(ts, trace_id),
                ],
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_under_the_preallocated_limit() {
        let table = FeatureTable::load(189).unwrap();
        assert_eq!(table.features, 189);
        let response = authorize("11:31:02.551Z", "5a1f0c9e7b2d", 189, 38.4, 7731);
        assert_eq!(response.status, 200);
        assert_eq!(
            response.logs[0],
            "11:31:02.551Z INFO  risk-scoring loaded feature file gen=7731 features=189 size=38.4KB"
        );
    }

    #[test]
    fn panics_when_the_feature_file_exceeds_200() {
        let response = authorize("11:28:04.118Z", "5a1f0c9e7b2d", 412, 79.3, 7730);
        assert_eq!(response.status, 500);
        assert_eq!(
            response.logs[0],
            "11:28:04.118Z ERROR risk-scoring thread=loader-2 PANIC: feature count 412 exceeds preallocated limit 200 (FeatureTable::load) - called unwrap() on Err(TooManyFeatures)"
        );
        assert_eq!(
            response.logs[1],
            "11:28:04.119Z ERROR http 500 POST /v1/authorizations trace_id=5a1f0c9e7b2d trace=risk.score -> panic"
                .replace("11:28:04.119Z", "11:28:04.118Z")
        );
    }

    #[test]
    #[should_panic(expected = "TooManyFeatures")]
    fn score_unwraps_too_many_features() {
        let _ = score(412);
    }
}
