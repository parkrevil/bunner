import { describe, test, expect, beforeAll, mock, beforeEach } from "bun:test";

const calls: { dlopen: Array<{ path: string; symbols: any }> } = { dlopen: [] };

const initLoggerSpy = mock(() => {});
const logMessageSpy = mock((level: number, msgPtr: Uint8Array) => {
  if (!(msgPtr instanceof Uint8Array)) throw new Error("msg is not Uint8Array");
  if (msgPtr[msgPtr.length - 1] !== 0) throw new Error("msg is not null-terminated");
});

const encodeCStringSpy = mock((message: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(message);
  const buf = new Uint8Array(bytes.length + 1);
  buf.set(bytes);
  buf[bytes.length] = 0;
  return buf;
});

const resolveRustLibPathSpy = mock((libName: string, dir: string) => {
  return `${dir}/rust/target/debug/lib${libName}.so`;
});

mock.module("bun:ffi", () => ({
  dlopen: (path: string, symbols: any) => {
    calls.dlopen.push({ path, symbols });
    return {
      symbols: {
        init_logger: initLoggerSpy,
        log_message: logMessageSpy,
      },
    } as any;
  }
}));

mock.module("@bunner/core", () => ({
  encodeCString: encodeCStringSpy,
  resolveRustLibPath: resolveRustLibPathSpy,
}));

let Logger: typeof import("./logger").Logger;

beforeAll(async () => {
  const mod = await import("./logger");
  Logger = mod.Logger;
});

beforeEach(() => {
  (initLoggerSpy as any).mock.calls.length = 0;
  (logMessageSpy as any).mock.calls.length = 0;
  (encodeCStringSpy as any).mock.calls.length = 0;
  (resolveRustLibPathSpy as any).mock.calls.length = 0;
  calls.dlopen.length = 0;
});

function decodeCString(buf: Uint8Array): string {
  const end = buf[buf.length - 1] === 0 ? buf.length - 1 : buf.length;
  return new TextDecoder().decode(buf.subarray(0, end));
}

function resetSingleton() {
  (Logger as any).instance = undefined;
}

function createLogger() {
  return new Logger();
}

function getLogger() {
  return Logger.getInstance();
}

function restoreMocks() {
  mock.module("bun:ffi", () => ({
    dlopen: (path: string, symbols: any) => {
      calls.dlopen.push({ path, symbols });
      return {
        symbols: {
          init_logger: initLoggerSpy,
          log_message: logMessageSpy,
        },
      } as any;
    }
  }));

  mock.module("@bunner/core", () => ({
    encodeCString: encodeCStringSpy,
    resolveRustLibPath: resolveRustLibPathSpy,
  }));
}

describe("Logger", () => {
  describe("Initialization", () => {
    describe("constructor", () => {
      test("calls dlopen with correct path and symbols", () => {
        createLogger();
        
        expect(calls.dlopen.length).toBe(1);
        expect(calls.dlopen[0].symbols).toEqual({
          init_logger: { args: [], returns: "void" },
          log_message: { args: ["i32", "cstring"], returns: "void" },
        });
      });

      test("calls resolveRustLibPath with correct parameters", () => {
        createLogger();
        
        const calls = (resolveRustLibPathSpy as any).mock.calls;
        expect(calls.length).toBe(1);
        expect(calls[0]?.[0]).toBe('bunner_core_logger');
        expect(calls[0]?.[1]).toContain('packages/core/logger');
      });

      test("throws error when dlopen fails", () => {
        mock.module("bun:ffi", () => ({
          dlopen: () => {
            throw new Error("dlopen failed");
          }
        }));

        expect(() => createLogger()).toThrow("Failed to initialize Logger: dlopen failed");

        restoreMocks();
      });

      test("throws error when resolveRustLibPath fails", () => {
        mock.module("@bunner/core", () => ({
          encodeCString: encodeCStringSpy,
          resolveRustLibPath: () => {
            throw new Error("resolveRustLibPath failed");
          }
        }));

        expect(() => createLogger()).toThrow("Failed to initialize Logger: resolveRustLibPath failed");

        restoreMocks();
      });

      test("handles dlopen returning invalid symbols", () => {
        mock.module("bun:ffi", () => ({
          dlopen: () => ({
            symbols: {
              init_logger: undefined,
              log_message: undefined,
            }
          })
        }));

        expect(() => {
          const logger = createLogger();
          logger.init();
        }).toThrow();

        restoreMocks();
      });

      test("handles dlopen returning null symbols", () => {
        mock.module("bun:ffi", () => ({
          dlopen: () => ({
            symbols: null
          })
        }));

        expect(() => {
          const logger = createLogger();
          logger.init();
        }).toThrow();

        restoreMocks();
      });
    });

    describe("getInstance", () => {
      test("returns same singleton instance", () => {
        const a = getLogger();
        const b = getLogger();
        expect(a).toBe(b);
      });

      test("calls constructor only once for singleton", () => {
        resetSingleton();
        calls.dlopen.length = 0;
        
        getLogger();
        getLogger();
        expect(calls.dlopen.length).toBe(1);
      });

      test("handles multiple getInstance calls after error", () => {
        resetSingleton();
        calls.dlopen.length = 0;
        
        mock.module("bun:ffi", () => ({
          dlopen: () => {
            throw new Error("dlopen failed");
          }
        }));

        expect(() => getLogger()).toThrow();

        restoreMocks();

        const logger = getLogger();
        expect(logger).toBeInstanceOf(Logger);
      });

      test("maintains singleton across multiple calls", () => {
        resetSingleton();
        
        const logger1 = getLogger();
        const logger2 = getLogger();
        const logger3 = getLogger();
        
        expect(logger1).toBe(logger2);
        expect(logger2).toBe(logger3);
        expect(logger1).toBe(logger3);
      });
    });

    describe("init", () => {
      let logger: import("./logger").Logger;

      beforeAll(() => {
        logger = getLogger();
      });

      test("calls native init_logger", () => {
        const before = (initLoggerSpy as any).mock.calls.length;
        logger.init();
        expect((initLoggerSpy as any).mock.calls.length).toBe(before + 1);
      });

      test("calls init_logger each time", () => {
        const before = (initLoggerSpy as any).mock.calls.length;
        logger.init();
        logger.init();
        expect((initLoggerSpy as any).mock.calls.length).toBe(before + 2);
      });

      test("throws error when init_logger is undefined", () => {
        const originalSymbols = (logger as any).symbols;
        (logger as any).symbols.init_logger = undefined;

        expect(() => logger.init()).toThrow();

        (logger as any).symbols = originalSymbols;
      });

      test("handles init_logger throwing error", () => {
        const originalInitLogger = (logger as any).symbols.init_logger;
        (logger as any).symbols.init_logger = () => {
          throw new Error("init_logger failed");
        };

        expect(() => logger.init()).toThrow("init_logger failed");

        (logger as any).symbols.init_logger = originalInitLogger;
      });

      test("throws error when symbols is null", () => {
        const originalSymbols = (logger as any).symbols;
        (logger as any).symbols = null;

        expect(() => logger.init()).toThrow();

        (logger as any).symbols = originalSymbols;
      });
    });
  });

  describe("Logging", () => {
    describe("log methods", () => {
      let logger: import("./logger").Logger;

      beforeAll(() => {
        logger = getLogger();
        logger.init();
      });

      const testLogMethod = (method: string, level: number) => {
        describe(method, () => {
          test(`calls log_message with ${method} level`, () => {
            const before = (logMessageSpy as any).mock.calls.length;
            (logger as any)[method]("test message");
            expect((logMessageSpy as any).mock.calls.length).toBe(before + 1);
            expect((logMessageSpy as any).mock.calls[before][0]).toBe(level);
          });

          test("calls encodeCString with message", () => {
            const message = `${method} test message`;
            const before = (encodeCStringSpy as any).mock.calls.length;
            (logger as any)[method](message);
            expect((encodeCStringSpy as any).mock.calls.length).toBe(before + 1);
            expect((encodeCStringSpy as any).mock.calls[before][0]).toBe(message);
          });

          test("passes encoded message to log_message", () => {
            const message = `${method} test`;
            (logger as any)[method](message);
            
            const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
            const encodedMessage = lastCall[1];
            
            expect(encodedMessage).toBeInstanceOf(Uint8Array);
            expect(decodeCString(encodedMessage)).toBe(message);
          });

          test("handles empty string", () => {
            (logger as any)[method]("");
            
            const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
            expect(decodeCString(lastCall[1])).toBe("");
          });

          test("handles unicode string", () => {
            const unicodeMsg = "한글✓🙂 UTF-8 message";
            (logger as any)[method](unicodeMsg);
            
            const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
            expect(decodeCString(lastCall[1])).toBe(unicodeMsg);
          });

          test("handles long string", () => {
            const longMsg = "x".repeat(1000);
            (logger as any)[method](longMsg);
            
            const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
            expect(decodeCString(lastCall[1])).toBe(longMsg);
          });

          test("throws error when log_message is undefined", () => {
            const originalLogMessage = (logger as any).symbols.log_message;
            (logger as any).symbols.log_message = undefined;

            expect(() => (logger as any)[method]("test")).toThrow();

            (logger as any).symbols.log_message = originalLogMessage;
          });

          test("throws error when encodeCString fails", () => {
            mock.module("@bunner/core", () => ({
              encodeCString: () => {
                throw new Error("encodeCString failed");
              },
              resolveRustLibPath: resolveRustLibPathSpy,
            }));

            expect(() => (logger as any)[method]("test")).toThrow("encodeCString failed");

            restoreMocks();
          });

          test("throws error when symbols is null", () => {
            const originalSymbols = (logger as any).symbols;
            (logger as any).symbols = null;

            expect(() => (logger as any)[method]("test")).toThrow();

            (logger as any).symbols = originalSymbols;
          });
        });
      };

      testLogMethod("trace", 0);
      testLogMethod("debug", 1);
      testLogMethod("info", 2);
      testLogMethod("warn", 3);
      testLogMethod("error", 4);
    });

    describe("log (private method)", () => {
      let logger: import("./logger").Logger;

      beforeAll(() => {
        logger = getLogger();
        logger.init();
      });

      test("calls log_message with correct level and encoded message", () => {
        const before = (logMessageSpy as any).mock.calls.length;
        logger.info("test message");
        
        const lastCall = (logMessageSpy as any).mock.calls[before];
        expect(lastCall[0]).toBe(2);
        expect(lastCall[1]).toBeInstanceOf(Uint8Array);
        expect(decodeCString(lastCall[1])).toBe("test message");
      });

      test("handles empty string", () => {
        logger.info("");
        
        const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
        expect(decodeCString(lastCall[1])).toBe("");
      });

      test("handles unicode string", () => {
        const unicodeMsg = "한글✓🙂 UTF-8 message";
        logger.info(unicodeMsg);
        
        const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
        expect(decodeCString(lastCall[1])).toBe(unicodeMsg);
      });

      test("handles special characters", () => {
        const specialMsg = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
        logger.info(specialMsg);
        
        const lastCall = (logMessageSpy as any).mock.calls[(logMessageSpy as any).mock.calls.length - 1];
        expect(decodeCString(lastCall[1])).toBe(specialMsg);
      });
    });
  });

  describe("Edge Cases", () => {
    test("handles concurrent getInstance calls", () => {
      resetSingleton();
      
      const promises = Array.from({ length: 10 }, () => 
        Promise.resolve().then(() => getLogger())
      );
      
      return Promise.all(promises).then((loggers) => {
        const first = loggers[0];
        loggers.forEach((logger: any) => {
          expect(logger).toBe(first);
        });
      });
    });

    test("handles multiple logger instances with different configurations", () => {
      resetSingleton();
      
      const logger1 = createLogger();
      const logger2 = createLogger();
      
      expect(logger1).not.toBe(logger2);
      expect(logger1).toBeInstanceOf(Logger);
      expect(logger2).toBeInstanceOf(Logger);
    });
  });
});
