.PHONY: test-core-logger

test-core-logger:
	@RUST_LOG=trace ./scripts/cargo-test.sh

