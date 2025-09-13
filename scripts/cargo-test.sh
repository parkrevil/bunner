#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Run all tests once for the entire workspace to avoid duplicate executions
BACKTRACE=1 cargo nextest run --workspace --target-dir "$ROOT_DIR/target" --features test,simd-json

# After tests, copy built dynamic libraries to each package's bin directory
for manifest in $(find "$ROOT_DIR/packages-ffi" -type f -name Cargo.toml); do
  pkg_dir=$(dirname "$manifest")
  dest_pkg_dir=$(echo "$pkg_dir" | sed "s/packages-ffi/packages/")
  bin_dir="$dest_pkg_dir/bin"

  pkg_name=$(grep "^name = " "$manifest" | head -1 | sed 's/name = "\([^"]*\)"/\1/')
  lib_name=$(grep "^name = " "$manifest" | grep -A1 "\[lib\]" | tail -1 | sed 's/name = "\([^"]*\)"/\1/' 2>/dev/null || echo "$pkg_name")

  mkdir -p "$bin_dir"

  SEARCH_DIRS=("$ROOT_DIR/target/debug/deps" "$ROOT_DIR/target/debug")
  expected_lib_name=$(echo "$lib_name" | sed 's/-/_/g')

  for SEARCH_DIR in "${SEARCH_DIRS[@]}"; do
    if [ -d "$SEARCH_DIR" ]; then
      for lib in "$SEARCH_DIR"/*.so "$SEARCH_DIR"/*.dll "$SEARCH_DIR"/*.dylib; do
        [ -f "$lib" ] || continue

        lib_basename=$(basename "$lib")

        # Accept both exact and hashed artifact names across platforms
        if [[ "$lib_basename" == "lib${expected_lib_name}.so" \
           || $lib_basename == lib${expected_lib_name}-*.so \
           || "$lib_basename" == "lib${expected_lib_name}.dylib" \
           || $lib_basename == lib${expected_lib_name}-*.dylib \
           || "$lib_basename" == "${expected_lib_name}.dll" \
           || $lib_basename == ${expected_lib_name}-*.dll ]]; then
          name_no_ext="${lib_basename%.*}"
          ext="${lib_basename##*.}"
          dest="$bin_dir/${name_no_ext}-dev.${ext}"
          cp "$lib" "$dest"
        fi
      done
    fi
  done

done