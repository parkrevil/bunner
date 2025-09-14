#!/usr/bin/env bash
# Stronger repository check to enforce per-function root test modules for Rust.
# - Scans Rust source files that contain test code for `mod <name>` declarations.
# - Flags disallowed generic module names (configurable list).
# - Follows `mod name;` includes into submodule files (searches `name.rs` and `name/mod.rs`).
# - For inline `mod name { ... }` ensures the module contains at least one `#[test]`.

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT"

# Disallowed generic names (case-insensitive)
DISALLOWED_REGEX='^(edge|edge_cases|misc|helpers|integration|smoke|utils|common|fixtures|helpers_tests)$'

ERRORS=0

declare -A VISITED_FILES

echo "Scanning Rust source files for root-module naming rules (including submodules)..."

function report_error() {
  echo "ERROR: $1"
  ERRORS=$((ERRORS+1))
}

function resolve_mod_file() {
  # args: base_dir, mod_name
  local base_dir="$1" mod_name="$2"
  if [ -f "$base_dir/$mod_name.rs" ]; then
    echo "$base_dir/$mod_name.rs"
    return
  fi
  if [ -f "$base_dir/$mod_name/mod.rs" ]; then
    echo "$base_dir/$mod_name/mod.rs"
    return
  fi
  # not found
  echo ""
}

function process_file() {
  local file="$1"
  # avoid re-processing
  if [[ -n "${VISITED_FILES[$file]:-}" ]]; then
    return
  fi
  VISITED_FILES[$file]=1

  # Only consider files that either are *_test.rs or contain #[cfg(test)]
  if [[ "$file" != *_test.rs ]] && ! grep -q "#\[cfg(test)\]" "$file" 2>/dev/null; then
    return
  fi

  local dir; dir=$(dirname "$file")

  # read file line-by-line to handle inline modules and `mod name;` includes
  awk -v file="$file" -v dir="$dir" -v root="$ROOT" '
  BEGIN{IGNORECASE=1}
  function trim(s){ sub(/^[ \t]+/,"",s); sub(/[ \t]+$/,"",s); return s }
  {
    line=$0; ln=NR
    # match mod declarations: mod name {  OR mod name;
    if (match(line, /(^|[[:space:]])mod[[:space:]]+([a-zA-Z0-9_]+)[[:space:]]*([;{])/, m)) {
      name=m[2]; delim=m[3];
      printf("MOD_DECL|%s|%d|%s|%s\n", file, ln, name, delim)
    }
  }
' "$file" | while IFS='|' read -r tag f ln name delim; do
    # check disallowed names (case-insensitive)
    if [[ "${name,,}" =~ $DISALLOWED_REGEX ]]; then
      report_error "$file:$ln - disallowed module name '$name'"
    fi

    if [[ "$delim" == "{" ]]; then
      # extract module block starting from that line to matching brace
      # use awk to capture balanced braces
      awk -v start_line="$ln" 'NR>=start_line{print; if (index($0,"{")>0) depth+=gsub("{","{"); if (index($0,"}")>0) depth-=gsub("}","}"); if (depth<=0 && NR>start_line) exit}' "$file" > /tmp/module_block.$$ || true
      if ! grep -q "#\[test\]" /tmp/module_block.$$ 2>/dev/null; then
        report_error "$file:$ln - module '$name' contains no #[test]"
      fi
      rm -f /tmp/module_block.$$
    else
      # semicolon include: try to resolve file and process it
      modfile=$(resolve_mod_file "$dir" "$name")
      if [[ -n "$modfile" ]]; then
        process_file "$modfile"
      else
        report_error "$file:$ln - module '$name' uses external file but target file not found"
      fi
    fi
  done
}

# Export helper functions and regex to be available in subshells invoked by awk loop
export -f process_file resolve_mod_file report_error
export DISALLOWED_REGEX

# Walk files: consider all .rs files under repo except target/.git dirs
shopt -s globstar
for f in **/*.rs; do
  case "$f" in
    target/*|.git/*) continue ;;
  esac
  process_file "$f"
done

if [ $ERRORS -ne 0 ]; then
  echo "Found $ERRORS test module issues. See errors above."
  exit 2
fi

echo "All test modules pass enhanced naming and test-content checks."
