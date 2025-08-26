# TODO

## Router
### Deferred
  - [ ] Use Rust WASM for the route matcher algorithm (Radix Tree)

## Injector
### Deferred
- Injector Core
  - [ ] Replace custom Injector Core with InversifyJS
  - [ ] Wrap module functionality with @Module.
  - [ ] Add controller import logic to @Module.
  - [ ] Set default scope of @Injectable to Singleton.
  - [ ] Replace circular dependency with Lazy Load.
  - [ ] Apply Request scope to @Injectable.

## Body Parser
### Deferred
- In-memory storage
- File storage
  - [ ] Store as a temporary file if the size exceeds a certain threshold. Options: storage directory and threshold bytes
  - [ ] Filter form-data file fields and data fields
