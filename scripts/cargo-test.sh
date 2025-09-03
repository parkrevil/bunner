#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

for manifest in $(find "$ROOT_DIR/packages-ffi" -type f -name Cargo.toml); do
  pkg_dir=$(dirname "$manifest")
  dest_pkg_dir=$(echo "$pkg_dir" | sed "s/packages-ffi/packages/")
  bin_dir="$dest_pkg_dir/bin"
  target_dir="$pkg_dir/target"

  pkg_name=$(grep "^name = " "$manifest" | head -1 | sed 's/name = "\([^"]*\)"/\1/')
  lib_name=$(grep "^name = " "$manifest" | grep -A1 "\[lib\]" | tail -1 | sed 's/name = "\([^"]*\)"/\1/' 2>/dev/null || echo "$pkg_name")

  mkdir -p "$bin_dir"
  cargo test --target-dir "$target_dir"

  DEPS_DIR="$target_dir/debug/deps"

  if [ -d "$DEPS_DIR" ]; then
    for lib in "$DEPS_DIR"/*.so "$DEPS_DIR"/*.dll "$DEPS_DIR"/*.dylib; do
      [ -f "$lib" ] || continue

      lib_basename=$(basename "$lib")
      
      expected_lib_name=$(echo "$lib_name" | sed 's/-/_/g')
      
      if [[ "$lib_basename" == "lib${expected_lib_name}.so" ]] || [[ "$lib_basename" == "${expected_lib_name}.dll" ]] || [[ "$lib_basename" == "lib${expected_lib_name}.dylib" ]]; then
        dest="$bin_dir/${lib_basename}"
        echo "Copying $lib_basename to $dest"
        cp "$lib" "$dest"
      fi
    done
  fi
done