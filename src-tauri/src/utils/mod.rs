// Logging utilities: application + activity logging setup.
pub mod logging {
    use log::LevelFilter;

    pub fn init() {
        let mut builder = env_logger::Builder::from_default_env();
        builder
            .filter_level(LevelFilter::Info)
            .format_timestamp_secs()
            .init();
    }

    pub fn log_activity(
        module: &str,
        action: &str,
        user_id: Option<i64>,
        record_id: Option<i64>,
    ) {
        log::info!(
            target: "activity",
            "[activity] module={} action={} user={} record={}",
            module,
            action,
            user_id.map(|v| v.to_string()).unwrap_or_else(|| "-".into()),
            record_id.map(|v| v.to_string()).unwrap_or_else(|| "-".into())
        );
    }
}
