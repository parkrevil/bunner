#!/bin/bash
set -euo pipefail

# Ensure a sane PATH even if invoked with env -i
if [[ -z "${PATH:-}" ]]; then
  export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
fi

# Config via env vars (provide sensible defaults)
URL=${URL:-http://localhost:5000/users}
DURATION=${DURATION:-30s}
CONCURRENCIES=${CONCURRENCIES:-"512 1024 2048 3072"}
RATE=${RATE:-}
REQUESTS=${REQUESTS:-}

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/tmp/stress/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT_DIR"

# Try to locate bombardier in common Go bin paths and augment PATH if needed
if ! command -v bombardier >/dev/null 2>&1; then
  CANDIDATES=()
  if command -v go >/dev/null 2>&1; then
    GOBIN_DIR=$(go env GOBIN 2>/dev/null || echo '')
    GOPATH_DIR=$(go env GOPATH 2>/dev/null || echo '')
    if [[ -n "${GOBIN_DIR:-}" ]]; then CANDIDATES+=("$GOBIN_DIR"); fi
    if [[ -n "${GOPATH_DIR:-}" ]]; then CANDIDATES+=("$GOPATH_DIR/bin"); fi
  fi
  if [[ -n "${HOME:-}" ]]; then
    CANDIDATES+=("$HOME/go/bin" "$HOME/.local/bin")
  fi
  CANDIDATES+=("/usr/local/bin" "/usr/bin")
  for dir in "${CANDIDATES[@]}"; do
    if [[ -x "$dir/bombardier" ]]; then
      export PATH="$dir:${PATH:-}"
      break
    fi
  done
fi

# Still not found: print actionable help
if ! command -v bombardier >/dev/null 2>&1; then
  echo "bombardier 실행 파일을 찾지 못했습니다. 설치 또는 PATH 설정이 필요합니다."
  echo "설치 예:"
  echo "  go install github.com/codesenberg/bombardier@latest"
  if command -v go >/dev/null 2>&1; then
    GOBIN_DIR=$(go env GOBIN 2>/dev/null || echo '')
    GOPATH_DIR=$(go env GOPATH 2>/dev/null || echo '')
    if [[ -z "${GOBIN_DIR:-}" ]]; then
      echo "zsh PATH에 추가 (영구적):"
      echo "  echo 'export PATH=\"$PATH:$(printf %q "$GOPATH_DIR")/bin\"' >> ~/.zshrc && source ~/.zshrc"
      echo "또는 현재 세션만:"
      echo "  export PATH=\"$PATH:$(printf %q "$GOPATH_DIR")/bin\""
    else
      echo "zsh PATH에 추가 (영구적):"
      echo "  echo 'export PATH=\"$PATH:$(printf %q "$GOBIN_DIR")\"' >> ~/.zshrc && source ~/.zshrc"
      echo "또는 현재 세션만:"
      echo "  export PATH=\"$PATH:$(printf %q "$GOBIN_DIR")\""
    fi
  else
    echo "Go가 설치되어 있지 않다면 패키지 매니저 또는 https://go.dev/dl 에서 설치하세요."
  fi
  echo "대안 도구(oha) 사용 가능: https://github.com/hatoo/oha"
  exit 1
fi

echo "[Stress] URL=$URL DURATION=$DURATION RATE=${RATE:-none} REQUESTS=${REQUESTS:-none}"
echo "[Stress] CONCURRENCIES: $CONCURRENCIES"

for c in $CONCURRENCIES; do
  log_file="$OUT_DIR/c${c}.log"
  echo "\n==== Concurrency: $c ====" | tee -a "$log_file"

  if [[ -n "$REQUESTS" ]]; then
    # Requests-bound run
    set -x
    bombardier -c "$c" -n "$REQUESTS" -l "$URL" | tee -a "$log_file"
    set +x
  else
    # Duration-bound run, optional rate limit
    if [[ -n "$RATE" ]]; then
      set -x
        bombardier -c "$c" -d "$DURATION" -r "$RATE" -l "$URL" | tee -a "$log_file"
      set +x
    else
      set -x
        bombardier -c "$c" -d "$DURATION" -l "$URL" | tee -a "$log_file"
      set +x
    fi
  fi
done

echo "\n결과 로그 디렉토리: $OUT_DIR"
