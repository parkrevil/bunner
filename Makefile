.PHONY: lint, format, test

lint:
	cargo clippy --all-targets --all-features -- -D warnings
format: 
	cargo fmt --all

test:
	@RUST_LOG=trace ./scripts/cargo-test.sh
