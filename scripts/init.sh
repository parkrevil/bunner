#!/bin/bash
set -euo pipefail

SCRIPTS_DIR="$(dirname "$0")"

# Ensure all scripts are executable
echo "Granting execute permissions to shell scripts in $SCRIPTS_DIR ..."
find "$SCRIPTS_DIR" -type f -name "*.sh" -exec chmod +x {} \;

# Install base OS packages (Debian/Ubuntu/WSL)
if command -v apt-get >/dev/null 2>&1; then
  echo "Installing system packages via apt-get ..."
  sudo apt-get update -y
  sudo apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    curl \
    git \
    ca-certificates \
    cmake
else
  echo "apt-get not found. Please install equivalent packages for your OS: build-essential, pkg-config, libssl-dev, curl, git, ca-certificates, cmake" >&2
fi

# Ensure toolchains and components (do not install rustup here)
echo "Ensuring Rust toolchains/components ..."
rustup toolchain install stable
rustup default stable
rustup component add --toolchain stable clippy rustfmt cargo-edit
# Install nightly only for tools that require it (e.g., cargo-udeps)
rustup toolchain install nightly

# Helper to install cargo tools if missing
ensure_cargo_tool() {
  local cmd="$1"; shift
  local crate="$1"; shift
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Installing $crate ..."
    cargo install --locked "$crate"
  fi
}

# Cargo developer tools
ensure_cargo_tool cargo-nextest cargo-nextest
ensure_cargo_tool cargo-criterion cargo-criterion
# cargo-udeps often requires nightly at runtime
ensure_cargo_tool cargo-udeps cargo-udeps
ensure_cargo_tool cargo-udeps cargo-udeps
ensure_cargo_tool cargo-edit cargo-edit

# Install Bun dependencies
bun i

# Summary
echo "\nEnvironment setup complete:"
