.PHONY: lint, format, test, coverage

lint:
	# Strict for library/bin targets
	cargo clippy --workspace --all-features -- \
		-D warnings \
		-D clippy::dbg_macro \
		-D clippy::todo \
		-D clippy::unimplemented \
		-D clippy::panic \
		-D clippy::print_stdout \
		-D clippy::print_stderr
	# Include tests/benches/examples with relaxed rules for panics/prints in tests
	cargo clippy --workspace --all-features --all-targets -- \
		-D warnings \
		-A clippy::panic \
		-A clippy::print_stdout \
		-A clippy::print_stderr
	
format: 
	cargo fmt --all

test:
	bash ./scripts/cargo-test.sh

coverage:
	cargo llvm-cov --workspace
