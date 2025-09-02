.PHONY: test

test:
	@RUST_LOG=trace ./scripts/cargo-test.sh

