.PHONY: lint, format, test, test-release, coverage, build, build-release

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

test-release:
	BUILD_MODE=release bash ./scripts/cargo-test.sh --release

coverage:
	cargo llvm-cov --workspace

build:
	bash ./scripts/cargo-build.sh

build-release:
	BUILD_MODE=release bash ./scripts/cargo-build.sh --release

# --- Stress Testing ---
.PHONY: stress stress-reqs stress-16c

# Defaults for other tasks; stress targets use fixed values below
URL ?= http://localhost:5000/users
DURATION ?= 60s
CONCURRENCIES ?= 512 1024 2048 3072
RATE ?=
REQUESTS ?=

# Duration-based sweep (fixed parameters; not affected by env/overrides)
stress:
	@env -i HOME="$(HOME)" URL="http://localhost:5000/users" DURATION="60s" CONCURRENCIES="512 1024 2048 3072" bash ./scripts/stress-bombardier.sh

# Requests-count run (fixed parameters)
stress-reqs: 
stress-reqs:
	@env -i HOME="$(HOME)" URL="http://localhost:5000/users" REQUESTS="1000000" bash ./scripts/stress-bombardier.sh

# 16-core oriented sweep (fixed parameters)
stress-16c:
	@env -i HOME="$(HOME)" URL="http://localhost:5000/users" DURATION="60s" CONCURRENCIES="800 1200 1600 2400 3200" bash ./scripts/stress-bombardier.sh
