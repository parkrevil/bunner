# TODO

## Injector

### P1 - Immediate
- **Scopes**
  - [ ] Transient scope implementation
  - [ ] Request/Scoped scope implementation
  - [ ] Dispose / OnModuleDestroy hooks

- **Provider types**
  - [ ] Factory providers
  - [ ] Value providers
  - [ ] Multi providers

- **Tokens / Injection**
  - [ ] Support Symbol/String tokens as injection tokens
  - [ ] Optional injection support

- **Resolution / Conflicts**
  - [ ] Duplicate binding detection (strict mode)
  - [ ] Deterministic resolution priority and documentation

- **Async / Config**
  - [ ] Async provider initialization
  - [ ] Config / Environment providers

- **Module chaining**
  - [ ] Verify transitive exports (A→AA→AAA) and document rules
  - [ ] Add tests for forwardRef import chaining

### P2 - Deferred
- **Testing / Override**
  - [ ] Module/Container-level binding override API

- **Diagnostics / Developer Experience**
  - [ ] Resolution trace / debug logging (toggleable)
  - [ ] Detailed error messages with resolution path/chain context
