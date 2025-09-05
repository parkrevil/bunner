.PHONY: lint, format, test, bench

lint:
	cargo clippy --fix --allow-dirty --all-targets --all-features -- -D warnings

format: 
	cargo fmt --all

test:
	@RUST_LOG=trace ./scripts/cargo-test.sh
