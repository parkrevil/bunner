.PHONY: lint, format, test

lint:
	cargo clippy --all-targets --all-features

format: 
	cargo fmt

test:
	@RUST_LOG=trace ./scripts/cargo-test.sh
