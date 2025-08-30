#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

for manifest in $(find "$ROOT_DIR/packages" -type f -name Cargo.toml); do
  pkg_dir=$(dirname "$manifest")
  pkg_name=$(basename "$pkg_dir")
  target_dir="$pkg_dir/target"
  bin_dir="$pkg_dir/../bin"

  mkdir -p "$bin_dir"

  cargo test --target-dir "$target_dir"

  DEPS_DIR="$target_dir/debug/deps"

  if [ -d "$DEPS_DIR" ]; then
    for lib in "$DEPS_DIR"/*.so "$DEPS_DIR"/*.dll "$DEPS_DIR"/*.dylib; do
      [ -f "$lib" ] || continue

      lib_name=$(basename "$lib")
      dest="$bin_dir/${lib_name}"

      cp "$lib" "$dest"
    done
  fi
done
