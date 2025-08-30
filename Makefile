.PHONY: test-core-logger build-core-logger build-core-logger-prod

build-core-logger:
	@echo "Building bunner-core-logger (release, rlib+cdylib)..."
	@cargo build --release -p bunner-core-logger
	@echo "Artifacts: target/release/libbunner_core_logger.rlib (for tests) and target/release/libbunner_core_logger.* (for FFI)"

test-core-logger:
	@echo "Running bunner-core-logger tests with RUST_LOG=trace..."
	@RUST_LOG=trace cargo test -p bunner-core-logger

