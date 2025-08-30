.PHONY: test-core-logger

test-core-logger:
	@echo "Running bunner-core-logger tests with RUST_LOG=trace..."
	@RUST_LOG=trace cargo test bunner-core-logger

