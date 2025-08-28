# TODO

## Router
### Deferred
  - [ ] Use Rust WASM for the route matcher algorithm (Radix Tree)

## Body Parser
### Deferred
- In-memory storage
- File storage
  - [ ] Store as a temporary file if the size exceeds a certain threshold. Options: storage directory and threshold bytes
  - [ ] Filter form-data file fields and data fields

## Compression
### Deferred (Streaming)
- [ ] Re-introduce CompressionStream-based streaming path when Bun supports it
- [ ] Adaptive sampling of first chunk to decide streaming vs identity
- [ ] Backpressure options (highWaterMark) when streaming path returns
- [ ] Tests: large ReadableStream, mid-size JSON stream, no-transform and Range with streams
- [ ] Metrics: report stream pre/post bytes and duration

### Tests
- [ ] Accept-Encoding negotiation: q-values, wildcard, identity preference
- [ ] ETag handling: preserveWeak, recompute with algorithm
- [ ] Skip rules: 204/304/206, Range, no-transform, already encoded, x-no-compress
- [ ] MIME filtering: compressible on/off, includeTypes/excludeTypes, vendor +json/+xml
- [ ] Thresholds: dynamicThreshold, dynamicMinRatio, small-string threshold
