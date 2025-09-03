#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

for manifest in $(find "$ROOT_DIR/packages-ffi" -type f -name Cargo.toml); do
  pkg_dir=$(dirname "$manifest")
  dest_pkg_dir=$(echo "$pkg_dir" | sed "s/packages-ffi/packages/")
  bin_dir="$dest_pkg_dir/bin"
  target_dir="$pkg_dir/target"

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