// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __legacyDecorateClassTS = function(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1;i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __legacyDecorateParamTS = (index, decorator) => (target, key) => decorator(target, key, index);

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/options.js
var require_options = __commonJS((exports) => {
  var __assign = exports && exports.__assign || function() {
    __assign = Object.assign || function(t) {
      for (var s, i = 1, n = arguments.length;i < n; i++) {
        s = arguments[i];
        for (var p in s)
          if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
      }
      return t;
    };
    return __assign.apply(this, arguments);
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var defaultOptions = {
    delayFirstAttempt: false,
    jitter: "none",
    maxDelay: Infinity,
    numOfAttempts: 10,
    retry: function() {
      return true;
    },
    startingDelay: 100,
    timeMultiple: 2
  };
  function getSanitizedOptions(options) {
    var sanitized = __assign(__assign({}, defaultOptions), options);
    if (sanitized.numOfAttempts < 1) {
      sanitized.numOfAttempts = 1;
    }
    return sanitized;
  }
  exports.getSanitizedOptions = getSanitizedOptions;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/jitter/full/full.jitter.js
var require_full_jitter = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  function fullJitter(delay) {
    var jitteredDelay = Math.random() * delay;
    return Math.round(jitteredDelay);
  }
  exports.fullJitter = fullJitter;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/jitter/no/no.jitter.js
var require_no_jitter = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  function noJitter(delay) {
    return delay;
  }
  exports.noJitter = noJitter;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/jitter/jitter.factory.js
var require_jitter_factory = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var full_jitter_1 = require_full_jitter();
  var no_jitter_1 = require_no_jitter();
  function JitterFactory(options) {
    switch (options.jitter) {
      case "full":
        return full_jitter_1.fullJitter;
      case "none":
      default:
        return no_jitter_1.noJitter;
    }
  }
  exports.JitterFactory = JitterFactory;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/delay/delay.base.js
var require_delay_base = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var jitter_factory_1 = require_jitter_factory();
  var Delay = function() {
    function Delay2(options) {
      this.options = options;
      this.attempt = 0;
    }
    Delay2.prototype.apply = function() {
      var _this = this;
      return new Promise(function(resolve) {
        return setTimeout(resolve, _this.jitteredDelay);
      });
    };
    Delay2.prototype.setAttemptNumber = function(attempt) {
      this.attempt = attempt;
    };
    Object.defineProperty(Delay2.prototype, "jitteredDelay", {
      get: function() {
        var jitter = jitter_factory_1.JitterFactory(this.options);
        return jitter(this.delay);
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Delay2.prototype, "delay", {
      get: function() {
        var constant = this.options.startingDelay;
        var base = this.options.timeMultiple;
        var power = this.numOfDelayedAttempts;
        var delay = constant * Math.pow(base, power);
        return Math.min(delay, this.options.maxDelay);
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Delay2.prototype, "numOfDelayedAttempts", {
      get: function() {
        return this.attempt;
      },
      enumerable: true,
      configurable: true
    });
    return Delay2;
  }();
  exports.Delay = Delay;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/delay/skip-first/skip-first.delay.js
var require_skip_first_delay = __commonJS((exports) => {
  var __extends = exports && exports.__extends || function() {
    var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2)
          if (b2.hasOwnProperty(p))
            d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var __generator = exports && exports.__generator || function(thisArg, body) {
    var _ = { label: 0, sent: function() {
      if (t[0] & 1)
        throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), throw: verb(1), return: verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f)
        throw new TypeError("Generator is already executing.");
      while (_)
        try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
            return t;
          if (y = 0, t)
            op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2])
                _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5)
        throw op[1];
      return { value: op[0] ? op[1] : undefined, done: true };
    }
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var delay_base_1 = require_delay_base();
  var SkipFirstDelay = function(_super) {
    __extends(SkipFirstDelay2, _super);
    function SkipFirstDelay2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    SkipFirstDelay2.prototype.apply = function() {
      return __awaiter(this, undefined, undefined, function() {
        return __generator(this, function(_a) {
          return [2, this.isFirstAttempt ? true : _super.prototype.apply.call(this)];
        });
      });
    };
    Object.defineProperty(SkipFirstDelay2.prototype, "isFirstAttempt", {
      get: function() {
        return this.attempt === 0;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(SkipFirstDelay2.prototype, "numOfDelayedAttempts", {
      get: function() {
        return this.attempt - 1;
      },
      enumerable: true,
      configurable: true
    });
    return SkipFirstDelay2;
  }(delay_base_1.Delay);
  exports.SkipFirstDelay = SkipFirstDelay;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/delay/always/always.delay.js
var require_always_delay = __commonJS((exports) => {
  var __extends = exports && exports.__extends || function() {
    var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2)
          if (b2.hasOwnProperty(p))
            d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    return function(d, b) {
      extendStatics(d, b);
      function __() {
        this.constructor = d;
      }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __);
    };
  }();
  Object.defineProperty(exports, "__esModule", { value: true });
  var delay_base_1 = require_delay_base();
  var AlwaysDelay = function(_super) {
    __extends(AlwaysDelay2, _super);
    function AlwaysDelay2() {
      return _super !== null && _super.apply(this, arguments) || this;
    }
    return AlwaysDelay2;
  }(delay_base_1.Delay);
  exports.AlwaysDelay = AlwaysDelay;
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/delay/delay.factory.js
var require_delay_factory = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  var skip_first_delay_1 = require_skip_first_delay();
  var always_delay_1 = require_always_delay();
  function DelayFactory(options, attempt) {
    var delay = initDelayClass(options);
    delay.setAttemptNumber(attempt);
    return delay;
  }
  exports.DelayFactory = DelayFactory;
  function initDelayClass(options) {
    if (!options.delayFirstAttempt) {
      return new skip_first_delay_1.SkipFirstDelay(options);
    }
    return new always_delay_1.AlwaysDelay(options);
  }
});

// ../node_modules/.bun/exponential-backoff@3.1.3/node_modules/exponential-backoff/dist/backoff.js
var require_backoff = __commonJS((exports) => {
  var __awaiter = exports && exports.__awaiter || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var __generator = exports && exports.__generator || function(thisArg, body) {
    var _ = { label: 0, sent: function() {
      if (t[0] & 1)
        throw t[1];
      return t[1];
    }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), throw: verb(1), return: verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() {
      return this;
    }), g;
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f)
        throw new TypeError("Generator is already executing.");
      while (_)
        try {
          if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
            return t;
          if (y = 0, t)
            op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2])
                _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5)
        throw op[1];
      return { value: op[0] ? op[1] : undefined, done: true };
    }
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var options_1 = require_options();
  var delay_factory_1 = require_delay_factory();
  function backOff(request, options) {
    if (options === undefined) {
      options = {};
    }
    return __awaiter(this, undefined, undefined, function() {
      var sanitizedOptions, backOff2;
      return __generator(this, function(_a) {
        switch (_a.label) {
          case 0:
            sanitizedOptions = options_1.getSanitizedOptions(options);
            backOff2 = new BackOff(request, sanitizedOptions);
            return [4, backOff2.execute()];
          case 1:
            return [2, _a.sent()];
        }
      });
    });
  }
  exports.backOff = backOff;
  var BackOff = function() {
    function BackOff2(request, options) {
      this.request = request;
      this.options = options;
      this.attemptNumber = 0;
    }
    BackOff2.prototype.execute = function() {
      return __awaiter(this, undefined, undefined, function() {
        var e_1, shouldRetry;
        return __generator(this, function(_a) {
          switch (_a.label) {
            case 0:
              if (!!this.attemptLimitReached)
                return [3, 7];
              _a.label = 1;
            case 1:
              _a.trys.push([1, 4, , 6]);
              return [4, this.applyDelay()];
            case 2:
              _a.sent();
              return [4, this.request()];
            case 3:
              return [2, _a.sent()];
            case 4:
              e_1 = _a.sent();
              this.attemptNumber++;
              return [4, this.options.retry(e_1, this.attemptNumber)];
            case 5:
              shouldRetry = _a.sent();
              if (!shouldRetry || this.attemptLimitReached) {
                throw e_1;
              }
              return [3, 6];
            case 6:
              return [3, 0];
            case 7:
              throw new Error("Something went wrong.");
          }
        });
      });
    };
    Object.defineProperty(BackOff2.prototype, "attemptLimitReached", {
      get: function() {
        return this.attemptNumber >= this.options.numOfAttempts;
      },
      enumerable: true,
      configurable: true
    });
    BackOff2.prototype.applyDelay = function() {
      return __awaiter(this, undefined, undefined, function() {
        var delay;
        return __generator(this, function(_a) {
          switch (_a.label) {
            case 0:
              delay = delay_factory_1.DelayFactory(this.options, this.attemptNumber);
              return [4, delay.apply()];
            case 1:
              _a.sent();
              return [2];
          }
        });
      });
    };
    return BackOff2;
  }();
});
// ../packages/logger/src/async-storage.ts
import { AsyncLocalStorage } from "async_hooks";

class RequestContext {
  static storage = new AsyncLocalStorage;
  static run(reqId, callback) {
    return this.storage.run(reqId, callback);
  }
  static getRequestId() {
    return this.storage.getStore();
  }
}

// ../packages/logger/src/transports/console.ts
var DEFAULT_COLORS = {
  trace: "gray",
  debug: "blue",
  info: "green",
  warn: "yellow",
  error: "red",
  fatal: "magenta"
};
var RESET = "\x1B[0m";
var COLORS = {
  black: "\x1B[30m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m"
};

class ConsoleTransport {
  options;
  constructor(options = {}) {
    this.options = options;
  }
  log(message) {
    const format = this.options.format || "pretty";
    if (format === "json") {
      this.logJson(message);
    } else {
      this.logPretty(message);
    }
  }
  logJson(message) {
    const replacer = (_key, value) => {
      if (value instanceof Error) {
        const { name, message: message2, stack, ...rest } = value;
        return {
          name,
          message: message2,
          stack,
          ...rest
        };
      }
      if (value && typeof value === "object" && "toLog" in value && typeof value.toLog === "function") {
        return value.toLog();
      }
      return value;
    };
    const str = JSON.stringify(message, replacer);
    process.stdout.write(str + `
`);
  }
  logPretty(message) {
    const { level, time, msg, context, reqId, workerId, err, ...rest } = message;
    const date = new Date(time);
    const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    const timeColored = `${COLORS.gray}${timeStr}${RESET}`;
    const color = this.options.prettyOptions?.colors?.[level] || DEFAULT_COLORS[level];
    const levelCode = COLORS[color] || COLORS.white;
    const levelStr = `${levelCode}${level.toUpperCase().padEnd(5)}${RESET}`;
    let metaStr = "";
    if (workerId !== undefined) {
      metaStr += `[W:${workerId}] `;
    }
    if (reqId) {
      metaStr += `[${reqId}] `;
    }
    if (context) {
      metaStr += `[${COLORS.cyan}${context}${RESET}] `;
    }
    const msgStr = `${levelCode}${msg}${RESET}`;
    const line = `${timeColored} ${levelStr} ${metaStr}${msgStr}`;
    if (level === "error" || level === "fatal") {
      console.error(line);
    } else {
      console.log(line);
    }
    if (err) {
      console.error(err);
    }
    if (Object.keys(rest).length > 0) {
      const processedRest = {};
      for (const [key, val] of Object.entries(rest)) {
        if (val && typeof val === "object" && "toLog" in val && typeof val.toLog === "function") {
          processedRest[key] = val.toLog();
        } else {
          processedRest[key] = val;
        }
      }
      console.log(Bun.inspect(processedRest, { colors: true, depth: 2 }));
    }
  }
}

// ../packages/logger/src/logger.ts
class Logger {
  static globalOptions = {
    level: "info",
    format: undefined
  };
  static transport = new ConsoleTransport(Logger.globalOptions);
  context;
  constructor(context) {
    if (typeof context === "function") {
      this.context = context.name;
    } else if (typeof context === "object" && context !== null) {
      this.context = context.constructor.name;
    } else if (typeof context === "string") {
      this.context = context;
    }
  }
  static configure(options) {
    this.globalOptions = { ...this.globalOptions, ...options };
    this.transport = new ConsoleTransport(this.globalOptions);
  }
  trace(msg, ...args) {
    this.log("trace", msg, ...args);
  }
  debug(msg, ...args) {
    this.log("debug", msg, ...args);
  }
  info(msg, ...args) {
    this.log("info", msg, ...args);
  }
  warn(msg, ...args) {
    this.log("warn", msg, ...args);
  }
  error(msg, ...args) {
    this.log("error", msg, ...args);
  }
  fatal(msg, ...args) {
    this.log("fatal", msg, ...args);
  }
  log(level, msg, ...args) {
    if (!this.isLevelEnabled(level)) {
      return;
    }
    const logMessage = {
      level,
      msg,
      time: Date.now(),
      context: this.context,
      reqId: RequestContext.getRequestId(),
      workerId: globalThis.WORKER_ID
    };
    for (const arg of args) {
      if (arg instanceof Error) {
        logMessage.err = arg;
      } else if (this.isLoggable(arg)) {
        Object.assign(logMessage, arg.toLog());
      } else if (typeof arg === "object" && arg !== null) {
        Object.assign(logMessage, arg);
      }
    }
    Logger.transport.log(logMessage);
  }
  isLevelEnabled(level) {
    const levels = ["trace", "debug", "info", "warn", "error", "fatal"];
    const configuredLevel = Logger.globalOptions.level || "info";
    return levels.indexOf(level) >= levels.indexOf(configuredLevel);
  }
  isLoggable(arg) {
    return arg && typeof arg === "object" && typeof arg.toLog === "function";
  }
}
// ../packages/core/src/common/constants.ts
var ROUTER_SNAPSHOT_METADATA = Symbol.for("bunner.router.snapshot");
// ../packages/core/src/common/instances.ts
var logger2 = new Logger("FinalizationRegistry");
var finalizationRegistry = new FinalizationRegistry((heldValue) => {
  logger2.debug(`${heldValue} has been GC'd`);
});
var textEncoder = new TextEncoder;
// ../packages/core/src/common/utils.ts
function capitalize(val) {
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
}
// ../packages/core/src/bunner.ts
class Bunner {
  static apps = new Map;
  static logger = new Logger(Bunner.name);
  static isShuttingDown = false;
  static signalsInitialized = false;
  static async create(appCls, rootModuleCls, options) {
    this.setupSignalHandlers();
    const aotContainer = globalThis.__BUNNER_CONTAINER__;
    const aotManifestPath = globalThis.__BUNNER_MANIFEST_PATH__;
    const aotMetadata = globalThis.__BUNNER_METADATA_REGISTRY__;
    if (!aotContainer) {
      this.logger.warn("\u26A0\uFE0F AOT Container not found.");
    }
    const normalizedOptions = this.normalizeOptions(options);
    if (this.apps.has(normalizedOptions.name)) {
      throw new Error(`Application with name "${normalizedOptions.name}" already exists`);
    }
    const app = new appCls({
      path: "aot-generated",
      className: rootModuleCls.name,
      container: aotContainer,
      manifestPath: aotManifestPath,
      metadata: aotMetadata
    }, normalizedOptions);
    await app.init();
    this.apps.set(normalizedOptions.name, app);
    return app;
  }
  static getApplications() {
    return Object.fromEntries(this.apps.entries());
  }
  static getApplication(name) {
    return this.apps.get(name);
  }
  static async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;
    const apps = Array.from(this.apps.values());
    await Promise.all(apps.map(async (app) => {
      try {
        await app.shutdown(true);
      } catch (e) {
        Bunner.logger.error("app shutdown failed", e);
      }
    })).catch((e) => Bunner.logger.error("Shutdown Error", e));
  }
  static generateApplicationDefaultName() {
    return `bunner--${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  static normalizeOptions(options) {
    const {
      name = this.generateApplicationDefaultName(),
      logLevel = 1 /* Debug */,
      queueCapacity = 8192,
      workers: workersInput = Math.floor(navigator.hardwareConcurrency / 2) ?? 1,
      ...appOptions
    } = options ?? {};
    let workers = workersInput;
    if (workers === "full") {
      workers = navigator.hardwareConcurrency;
    } else if (workers === "half") {
      workers = Math.floor(navigator.hardwareConcurrency / 2) || 1;
    }
    return {
      ...appOptions,
      name,
      logLevel,
      workers,
      queueCapacity
    };
  }
  static setupSignalHandlers() {
    if (this.signalsInitialized) {
      return;
    }
    const handler = async (signal) => {
      let exitCode = 0;
      try {
        Bunner.logger.info("\uD83D\uDED1 Shutting down...");
        await Promise.race([
          this.shutdown(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("shutdown timeout")), 1e4))
        ]);
      } catch (e) {
        Bunner.logger.error(`graceful shutdown failed on ${signal}`, e);
        exitCode = 1;
      } finally {
        try {
          process.exit(exitCode);
        } catch {}
      }
    };
    ["SIGINT", "SIGTERM", "SIGQUIT", "SIGHUP", "SIGUSR2"].forEach((sig) => {
      process.on(sig, (signal) => void handler(signal));
    });
    this.signalsInitialized = true;
  }
}
// ../packages/core/src/application/base-application.ts
class BaseApplication {
  options;
}
// ../packages/core/src/application/decorators/class.decorator.ts
function Injectable() {
  return (value, context) => {
    if (context.kind !== "class") {
      throw new Error(`@Injectable must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}
function Module(_metadata) {
  return (value, context) => {
    if (context.kind !== "class") {
      throw new Error(`@Module must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}
function RootModule(_metadata) {
  return (value, context) => {
    if (context.kind !== "class") {
      throw new Error(`@RootModule must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}
// ../packages/core/src/injector/container.ts
class Container {
  factories = new Map;
  instances = new Map;
  constructor(initialFactories) {
    if (initialFactories) {
      this.factories = initialFactories;
    }
  }
  set(token, factory) {
    this.factories.set(token, factory);
  }
  get(token) {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`No provider for token: ${token.name || token}`);
    }
    const instance = factory(this);
    this.instances.set(token, instance);
    return instance;
  }
  keys() {
    return this.factories.keys();
  }
  async loadDynamicModule(scope, dynamicModule) {
    if (!dynamicModule) {
      return;
    }
    await Promise.resolve();
    const providers = dynamicModule.providers || [];
    for (const p of providers) {
      let token;
      let factory;
      if (typeof p === "function") {
        token = p;
        factory = (c) => new p(...this.resolveDepsFor(p, scope, c));
      } else if (p.provide) {
        token = p.provide;
        if (p.useValue) {
          factory = () => p.useValue;
        } else if (p.useFactory) {
          factory = async (c) => {
            const args = (p.inject || []).map((t) => c.get(t));
            return await p.useFactory(...args);
          };
        } else {
          factory = () => null;
        }
      }
      let keyStr = "";
      if (typeof token === "string") {
        keyStr = `${scope}::${token}`;
      } else if (token.name) {
        keyStr = `${scope}::${token.name}`;
      }
      if (keyStr && factory) {
        this.set(keyStr, factory);
      }
    }
  }
  resolveDepsFor(_ctor, _scope, _c) {
    return [];
  }
}
// ../packages/core/src/injector/constants.ts
var METADATA_KEY_PREFIX = "b:c:";
// ../packages/core/src/injector/enums.ts
var MetadataKey;
((MetadataKey2) => {
  MetadataKey2["RootModule"] = `${METADATA_KEY_PREFIX}rm`;
  MetadataKey2["Module"] = `${METADATA_KEY_PREFIX}m`;
  MetadataKey2["Injectable"] = `${METADATA_KEY_PREFIX}ia`;
  MetadataKey2["Inject"] = `${METADATA_KEY_PREFIX}i`;
})(MetadataKey ||= {});
// ../packages/core/src/errors/errors.ts
class BunnerError extends Error {
  constructor(message) {
    super(message);
  }
}
// ../packages/core/src/worker-pool/worker-pool.ts
var {nanoseconds } = globalThis.Bun;

// ../node_modules/.bun/comlink@4.4.2/node_modules/comlink/dist/esm/comlink.mjs
var proxyMarker = Symbol("Comlink.proxy");
var createEndpoint = Symbol("Comlink.endpoint");
var releaseProxy = Symbol("Comlink.releaseProxy");
var finalizer = Symbol("Comlink.finalizer");
var throwMarker = Symbol("Comlink.thrown");
var isObject = (val) => typeof val === "object" && val !== null || typeof val === "function";
var proxyTransferHandler = {
  canHandle: (val) => isObject(val) && val[proxyMarker],
  serialize(obj) {
    const { port1, port2 } = new MessageChannel;
    expose(obj, port1);
    return [port2, [port2]];
  },
  deserialize(port) {
    port.start();
    return wrap(port);
  }
};
var throwTransferHandler = {
  canHandle: (value) => isObject(value) && (throwMarker in value),
  serialize({ value }) {
    let serialized;
    if (value instanceof Error) {
      serialized = {
        isError: true,
        value: {
          message: value.message,
          name: value.name,
          stack: value.stack
        }
      };
    } else {
      serialized = { isError: false, value };
    }
    return [serialized, []];
  },
  deserialize(serialized) {
    if (serialized.isError) {
      throw Object.assign(new Error(serialized.value.message), serialized.value);
    }
    throw serialized.value;
  }
};
var transferHandlers = new Map([
  ["proxy", proxyTransferHandler],
  ["throw", throwTransferHandler]
]);
function isAllowedOrigin(allowedOrigins, origin) {
  for (const allowedOrigin of allowedOrigins) {
    if (origin === allowedOrigin || allowedOrigin === "*") {
      return true;
    }
    if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
      return true;
    }
  }
  return false;
}
function expose(obj, ep = globalThis, allowedOrigins = ["*"]) {
  ep.addEventListener("message", function callback(ev) {
    if (!ev || !ev.data) {
      return;
    }
    if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
      console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
      return;
    }
    const { id, type, path } = Object.assign({ path: [] }, ev.data);
    const argumentList = (ev.data.argumentList || []).map(fromWireValue);
    let returnValue;
    try {
      const parent = path.slice(0, -1).reduce((obj2, prop) => obj2[prop], obj);
      const rawValue = path.reduce((obj2, prop) => obj2[prop], obj);
      switch (type) {
        case "GET":
          {
            returnValue = rawValue;
          }
          break;
        case "SET":
          {
            parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
            returnValue = true;
          }
          break;
        case "APPLY":
          {
            returnValue = rawValue.apply(parent, argumentList);
          }
          break;
        case "CONSTRUCT":
          {
            const value = new rawValue(...argumentList);
            returnValue = proxy(value);
          }
          break;
        case "ENDPOINT":
          {
            const { port1, port2 } = new MessageChannel;
            expose(obj, port2);
            returnValue = transfer(port1, [port1]);
          }
          break;
        case "RELEASE":
          {
            returnValue = undefined;
          }
          break;
        default:
          return;
      }
    } catch (value) {
      returnValue = { value, [throwMarker]: 0 };
    }
    Promise.resolve(returnValue).catch((value) => {
      return { value, [throwMarker]: 0 };
    }).then((returnValue2) => {
      const [wireValue, transferables] = toWireValue(returnValue2);
      ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
      if (type === "RELEASE") {
        ep.removeEventListener("message", callback);
        closeEndPoint(ep);
        if (finalizer in obj && typeof obj[finalizer] === "function") {
          obj[finalizer]();
        }
      }
    }).catch((error) => {
      const [wireValue, transferables] = toWireValue({
        value: new TypeError("Unserializable return value"),
        [throwMarker]: 0
      });
      ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
    });
  });
  if (ep.start) {
    ep.start();
  }
}
function isMessagePort(endpoint) {
  return endpoint.constructor.name === "MessagePort";
}
function closeEndPoint(endpoint) {
  if (isMessagePort(endpoint))
    endpoint.close();
}
function wrap(ep, target) {
  const pendingListeners = new Map;
  ep.addEventListener("message", function handleMessage(ev) {
    const { data } = ev;
    if (!data || !data.id) {
      return;
    }
    const resolver = pendingListeners.get(data.id);
    if (!resolver) {
      return;
    }
    try {
      resolver(data);
    } finally {
      pendingListeners.delete(data.id);
    }
  });
  return createProxy(ep, pendingListeners, [], target);
}
function throwIfProxyReleased(isReleased) {
  if (isReleased) {
    throw new Error("Proxy has been released and is not useable");
  }
}
function releaseEndpoint(ep) {
  return requestResponseMessage(ep, new Map, {
    type: "RELEASE"
  }).then(() => {
    closeEndPoint(ep);
  });
}
var proxyCounter = new WeakMap;
var proxyFinalizers = "FinalizationRegistry" in globalThis && new FinalizationRegistry((ep) => {
  const newCount = (proxyCounter.get(ep) || 0) - 1;
  proxyCounter.set(ep, newCount);
  if (newCount === 0) {
    releaseEndpoint(ep);
  }
});
function registerProxy(proxy, ep) {
  const newCount = (proxyCounter.get(ep) || 0) + 1;
  proxyCounter.set(ep, newCount);
  if (proxyFinalizers) {
    proxyFinalizers.register(proxy, ep, proxy);
  }
}
function unregisterProxy(proxy) {
  if (proxyFinalizers) {
    proxyFinalizers.unregister(proxy);
  }
}
function createProxy(ep, pendingListeners, path = [], target = function() {}) {
  let isProxyReleased = false;
  const proxy = new Proxy(target, {
    get(_target, prop) {
      throwIfProxyReleased(isProxyReleased);
      if (prop === releaseProxy) {
        return () => {
          unregisterProxy(proxy);
          releaseEndpoint(ep);
          pendingListeners.clear();
          isProxyReleased = true;
        };
      }
      if (prop === "then") {
        if (path.length === 0) {
          return { then: () => proxy };
        }
        const r = requestResponseMessage(ep, pendingListeners, {
          type: "GET",
          path: path.map((p) => p.toString())
        }).then(fromWireValue);
        return r.then.bind(r);
      }
      return createProxy(ep, pendingListeners, [...path, prop]);
    },
    set(_target, prop, rawValue) {
      throwIfProxyReleased(isProxyReleased);
      const [value, transferables] = toWireValue(rawValue);
      return requestResponseMessage(ep, pendingListeners, {
        type: "SET",
        path: [...path, prop].map((p) => p.toString()),
        value
      }, transferables).then(fromWireValue);
    },
    apply(_target, _thisArg, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased);
      const last = path[path.length - 1];
      if (last === createEndpoint) {
        return requestResponseMessage(ep, pendingListeners, {
          type: "ENDPOINT"
        }).then(fromWireValue);
      }
      if (last === "bind") {
        return createProxy(ep, pendingListeners, path.slice(0, -1));
      }
      const [argumentList, transferables] = processArguments(rawArgumentList);
      return requestResponseMessage(ep, pendingListeners, {
        type: "APPLY",
        path: path.map((p) => p.toString()),
        argumentList
      }, transferables).then(fromWireValue);
    },
    construct(_target, rawArgumentList) {
      throwIfProxyReleased(isProxyReleased);
      const [argumentList, transferables] = processArguments(rawArgumentList);
      return requestResponseMessage(ep, pendingListeners, {
        type: "CONSTRUCT",
        path: path.map((p) => p.toString()),
        argumentList
      }, transferables).then(fromWireValue);
    }
  });
  registerProxy(proxy, ep);
  return proxy;
}
function myFlat(arr) {
  return Array.prototype.concat.apply([], arr);
}
function processArguments(argumentList) {
  const processed = argumentList.map(toWireValue);
  return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))];
}
var transferCache = new WeakMap;
function transfer(obj, transfers) {
  transferCache.set(obj, transfers);
  return obj;
}
function proxy(obj) {
  return Object.assign(obj, { [proxyMarker]: true });
}
function toWireValue(value) {
  for (const [name, handler] of transferHandlers) {
    if (handler.canHandle(value)) {
      const [serializedValue, transferables] = handler.serialize(value);
      return [
        {
          type: "HANDLER",
          name,
          value: serializedValue
        },
        transferables
      ];
    }
  }
  return [
    {
      type: "RAW",
      value
    },
    transferCache.get(value) || []
  ];
}
function fromWireValue(value) {
  switch (value.type) {
    case "HANDLER":
      return transferHandlers.get(value.name).deserialize(value.value);
    case "RAW":
      return value.value;
  }
}
function requestResponseMessage(ep, pendingListeners, msg, transfers) {
  return new Promise((resolve) => {
    const id = generateUUID();
    pendingListeners.set(id, resolve);
    if (ep.start) {
      ep.start();
    }
    ep.postMessage(Object.assign({ id }, msg), transfers);
  });
}
function generateUUID() {
  return new Array(4).fill(0).map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)).join("-");
}

// ../packages/core/src/worker-pool/worker-pool.ts
var import_exponential_backoff = __toESM(require_backoff(), 1);

// ../packages/core/src/worker-pool/load-balancer.ts
class LoadBalancer {
  alpha;
  eps;
  memoryLimit;
  responseTimeLimit;
  slots;
  weights;
  logger = new Logger(LoadBalancer.name);
  constructor(count) {
    this.alpha = 0.2;
    this.eps = 0.000001;
    this.memoryLimit = 512 * 1024 * 1024;
    this.responseTimeLimit = 1000;
    this.weights = {
      active: 0.7,
      cpu: 0.2,
      memory: 0.05,
      responseTime: 0.05
    };
    this.slots = Array.from({ length: count }, () => ({
      active: 0,
      cpu: 0,
      memory: 0,
      responseTime: 0
    }));
  }
  addSlot(id) {
    this.slots[id] = {
      active: 0,
      cpu: 0,
      memory: 0,
      responseTime: 0
    };
  }
  deleteSlot(id) {
    this.slots[id] = undefined;
  }
  acquire() {
    let bestSlot;
    let bestScore = Infinity;
    this.slots.forEach((slot, id) => {
      if (!slot) {
        return;
      }
      const score = this.getScore(slot);
      if (score < bestScore) {
        bestSlot = id;
        bestScore = score;
      }
    });
    this.logger.trace(`Acquired slot: ${bestSlot} (Score: ${bestScore})`);
    return bestSlot;
  }
  increaseActive(id) {
    if (!this.slots[id]) {
      return;
    }
    this.slots[id].active++;
  }
  decreaseActive(id) {
    if (!this.slots[id]) {
      return;
    }
    this.slots[id].active = Math.max(0, this.slots[id].active - 1);
  }
  updateStats(id, stats) {
    this.logger.trace(`Updating stats for worker #${id}`, stats);
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    let { cpu, memory, responseTime } = stats;
    if (cpu > 1) {
      cpu = Math.min(100, cpu) / 100;
    }
    slot.cpu = this.alpha * cpu + (1 - this.alpha) * slot.cpu;
    memory = Math.min(1, memory / Math.max(this.memoryLimit, 1));
    slot.memory = this.alpha * memory + (1 - this.alpha) * slot.memory;
    responseTime = Math.min(1, responseTime / Math.max(this.responseTimeLimit, 1));
    slot.responseTime = this.alpha * responseTime + (1 - this.alpha) * slot.responseTime;
  }
  getScore(slot) {
    if (!slot) {
      return Infinity;
    }
    const active = slot.active / (slot.active + 1 + this.eps);
    const cpu = Math.max(0, Math.min(1, slot.cpu));
    const memory = Math.max(0, Math.min(1, slot.memory));
    const responseTime = Math.max(0, Math.min(1, slot.responseTime));
    return this.weights.active * active + this.weights.cpu * cpu + this.weights.memory * memory + this.weights.responseTime * responseTime;
  }
}

// ../packages/core/src/worker-pool/worker-pool.ts
class WorkerPool {
  script;
  reviving = new Set;
  workers;
  loadBalancer;
  logger = new Logger(WorkerPool.name);
  statsTimer;
  destroying = false;
  initParams;
  bootstrapParams;
  constructor(options) {
    const size = options?.size ?? navigator.hardwareConcurrency;
    this.script = options.script;
    this.loadBalancer = new LoadBalancer(size);
    this.workers = Array.from({ length: size }, (_, id) => this.spawnWorker(id));
  }
  async destroy() {
    this.destroying = true;
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
    await Promise.all(this.workers.map((_, id) => this.destroyWorker(id)));
  }
  async call(method, ...args) {
    let workerId;
    let increased = false;
    try {
      workerId = this.loadBalancer.acquire();
      if (workerId === undefined) {
        throw new BunnerError("no available workers");
      }
      if (!this.workers[workerId]) {
        this.loadBalancer.deleteSlot(workerId);
        throw new BunnerError(`worker ${workerId} is not available`);
      }
      const fn = this.workers[workerId].remote[method];
      this.loadBalancer.increaseActive(workerId);
      increased = true;
      return await fn(...args);
    } finally {
      if (workerId !== undefined && increased) {
        this.loadBalancer.decreaseActive(workerId);
      }
    }
  }
  async init(params) {
    this.initParams = params;
    await Promise.all(this.workers.map((worker, id) => worker ? worker.remote.init(id, params) : Promise.resolve()));
    if (!this.statsTimer) {
      this.statsTimer = setInterval(() => {
        this.collectWorkerStats();
      }, 1000);
    }
  }
  async bootstrap(params) {
    this.bootstrapParams = params;
    await Promise.all(this.workers.map((worker) => worker ? worker.remote.bootstrap(params) : Promise.resolve()));
  }
  spawnWorker(id) {
    const native = new Worker(this.script.href);
    native.addEventListener("error", (e) => {
      this.handleCrash("error", id, e);
    });
    native.addEventListener("messageerror", (e) => {
      this.handleCrash("messageerror", id, e);
    });
    native.addEventListener("close", (e) => {
      this.handleCrash("close", id, e);
    });
    return { remote: wrap(native), native };
  }
  async handleCrash(event, id, e) {
    if (this.destroying) {
      return;
    }
    this.logger.error(`\uD83D\uDCA5 Worker #${id} ${event}: `, e);
    await this.destroyWorker(id).catch(() => {});
    this.workers[id] = undefined;
    this.reviveWorker(id);
  }
  reviveWorker(id) {
    if (this.destroying || this.reviving.has(id)) {
      return;
    }
    this.reviving.add(id);
    let attempt = 0;
    import_exponential_backoff.backOff(async () => {
      if (this.destroying) {
        this.reviving.delete(id);
        throw new Error;
      }
      ++attempt;
      this.logger.info(`\uD83E\uDE7A Revive attempt ${attempt} for worker #${id}`);
      const worker = this.spawnWorker(id);
      await worker.remote.init(id, this.initParams);
      await worker.remote.bootstrap(this.bootstrapParams);
      this.workers[id] = worker;
      this.loadBalancer.addSlot(id);
      this.reviving.delete(id);
    }, {
      numOfAttempts: 50,
      startingDelay: 300,
      maxDelay: 30000,
      timeMultiple: 2,
      jitter: "full",
      delayFirstAttempt: true,
      retry: () => !this.destroying
    }).catch(() => {
      this.reviving.delete(id);
    });
  }
  async destroyWorker(id) {
    this.loadBalancer.deleteSlot(id);
    const worker = this.workers[id];
    if (!worker) {
      return;
    }
    this.reviving.delete(id);
    await worker.remote.destroy();
    worker.native.terminate();
    worker.remote[releaseProxy]();
  }
  async collectWorkerStats() {
    await Promise.all(this.workers.map(async (worker, id) => {
      if (!worker) {
        return;
      }
      const startTime = nanoseconds();
      const stats = await worker.remote.getStats().catch(() => null);
      if (!stats) {
        return;
      }
      this.loadBalancer.updateStats(id, {
        ...stats,
        responseTime: nanoseconds() - startTime
      });
    }));
  }
}
// ../packages/core/src/metadata/metadata-storage.ts
Symbol.metadata ??= Symbol("Symbol.metadata");
var BUNNER_METADATA = Symbol("BUNNER_METADATA");

class MetadataStorage {
  static addDecoratorMetadata(context, metadata) {
    const metaObj = context.metadata[BUNNER_METADATA] || { properties: {} };
    context.metadata[BUNNER_METADATA] = metaObj;
    const propKey = String(context.name);
    if (!metaObj.properties[propKey]) {
      metaObj.properties[propKey] = { decorators: [] };
    }
    metaObj.properties[propKey].decorators.push(metadata);
  }
  static getMetadata(target) {
    const meta = target[Symbol.metadata];
    return meta ? meta[BUNNER_METADATA] : undefined;
  }
}

// ../packages/core/src/validator/decorators.ts
function createDecorator(name, args = [], options = {}) {
  return function(_, context) {
    if (context && context.kind !== "field") {
      throw new Error(`@${name} must be used on a field. Used on: ${context.kind}`);
    }
    MetadataStorage.addDecoratorMetadata(context, {
      name,
      arguments: args,
      options
    });
  };
}
function IsString(options) {
  return createDecorator("IsString", [], options);
}
function IsNumber(options) {
  return createDecorator("IsNumber", [], options);
}
function IsBoolean(options) {
  return createDecorator("IsBoolean", [], options);
}
function IsArray(options) {
  return createDecorator("IsArray", [], options);
}
function IsOptional(options) {
  return createDecorator("IsOptional", [], options);
}
function IsIn(values, options) {
  return createDecorator("IsIn", [values], options);
}
function Min(min, options) {
  return createDecorator("Min", [min], options);
}
function Max(max, options) {
  return createDecorator("Max", [max], options);
}
function ValidateNested(options) {
  return createDecorator("ValidateNested", [], options);
}
// ../packages/core/src/metadata/metadata-consumer.ts
class MetadataConsumer {
  static cliRegistry = new Map;
  static registerCLIMetadata(registry) {
    this.cliRegistry = registry;
  }
  static getCombinedMetadata(target) {
    if (this.cliRegistry.size === 0 && globalThis.__BUNNER_METADATA_REGISTRY__) {
      this.cliRegistry = globalThis.__BUNNER_METADATA_REGISTRY__;
    }
    const runtimeMeta = MetadataStorage.getMetadata(target) || { properties: {} };
    const cliMeta = this.cliRegistry.get(target);
    if (!cliMeta) {
      return this.normalizeRuntimeMeta(runtimeMeta);
    }
    const mergedProperties = {};
    cliMeta.properties.forEach((cliProp) => {
      mergedProperties[cliProp.name] = {
        ...cliProp,
        decorators: [...cliProp.decorators || []]
      };
      const runtimeProp = runtimeMeta.properties[cliProp.name];
      if (runtimeProp && runtimeProp.decorators) {
        mergedProperties[cliProp.name].decorators.push(...runtimeProp.decorators);
      }
    });
    return {
      className: cliMeta.className || target.name,
      properties: mergedProperties
    };
  }
  static normalizeRuntimeMeta(runtimeMeta) {
    const properties = {};
    for (const [key, value] of Object.entries(runtimeMeta.properties)) {
      properties[key] = {
        name: key,
        type: "any",
        decorators: value.decorators || [],
        isOptional: false,
        isArray: false
      };
    }
    return { properties };
  }
}

// ../packages/core/src/validator/validator-compiler.ts
class ValidatorCompiler {
  static cache = new Map;
  static compile(target) {
    if (this.cache.has(target)) {
      return this.cache.get(target);
    }
    const metadata = MetadataConsumer.getCombinedMetadata(target);
    const lines = [];
    lines.push("const errors = [];");
    lines.push("if (!obj || typeof obj !== 'object') return ['Invalid object'];");
    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop;
      const access = `obj['${propName}']`;
      if (p.isOptional) {
        lines.push(`if (${access} !== undefined && ${access} !== null) {`);
      } else {
        lines.push("{");
      }
      if (p.isArray) {
        lines.push(`  if (!Array.isArray(${access})) {`);
        lines.push(`    errors.push('${propName} must be an array');`);
        lines.push("  } else {");
        lines.push(`    for (let i = 0; i < ${access}.length; i++) {`);
        lines.push(`      const val = ${access}[i];`);
        lines.push("    }");
        lines.push("  }");
      }
      p.decorators.forEach((dec) => {
        const { name, arguments: args, options } = dec;
        const msg = options?.message || `${propName} check failed for ${name}`;
        if (name === "IsString") {
          lines.push(`  if (typeof ${access} !== 'string') errors.push('${msg}');`);
        } else if (name === "IsNumber") {
          lines.push(`  if (typeof ${access} !== 'number' || Number.isNaN(${access})) errors.push('${msg}');`);
        } else if (name === "IsInt") {
          lines.push(`  if (!Number.isInteger(${access})) errors.push('${msg}');`);
        } else if (name === "IsBoolean") {
          lines.push(`  if (typeof ${access} !== 'boolean') errors.push('${msg}');`);
        } else if (name === "Min") {
          lines.push(`  if (${access} < ${args[0]}) errors.push('${msg}');`);
        } else if (name === "Max") {
          lines.push(`  if (${access} > ${args[0]}) errors.push('${msg}');`);
        } else if (name === "IsIn") {
          const validValues = JSON.stringify(args[0]);
          lines.push(`  if (!${validValues}.includes(${access})) errors.push('${msg}');`);
        } else if (name === "ValidateNested") {
          if (p.metatype) {
            lines.push(`  const nestedErrors = validators.getValidator(${access}, classRefs['${propName}']);`);
            lines.push(`  if (nestedErrors.length > 0) errors.push(...nestedErrors.map(e => \`${propName}.\${e}\`));`);
          }
        }
      });
      lines.push("}");
    }
    lines.push("return errors;");
    const fnBody = lines.join(`
`);
    try {
      const classRefs = {};
      for (const [propName, prop] of Object.entries(metadata.properties)) {
        if (prop.metatype) {
          classRefs[propName] = prop.metatype;
        }
      }
      const validators = {
        getValidator: (val, Target) => {
          if (!val || !Target)
            return [];
          if (Array.isArray(val)) {
            let allErrors = [];
            val.forEach((item, i) => {
              const errors3 = ValidatorCompiler.compile(Target)(item);
              allErrors.push(...errors3.map((e) => `[${i}].${e}`));
            });
            return allErrors;
          }
          return ValidatorCompiler.compile(Target)(val);
        }
      };
      const fn = new Function("obj", "validators", "classRefs", fnBody);
      const wrappedFn = (obj) => fn(obj, validators, classRefs);
      this.cache.set(target, wrappedFn);
      return wrappedFn;
    } catch (e) {
      console.error("Failed to compile validator", fnBody);
      throw e;
    }
  }
}
// ../packages/core/src/transformer/transformer-compiler.ts
class TransformerCompiler {
  static p2iCache = new Map;
  static i2pCache = new Map;
  static compilePlainToInstance(target) {
    if (this.p2iCache.has(target)) {
      return this.p2iCache.get(target);
    }
    const metadata = MetadataConsumer.getCombinedMetadata(target);
    const bodyLines = [];
    bodyLines.push("const instance = new Target();");
    bodyLines.push("if (!plain || typeof plain !== 'object') return instance;");
    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop;
      const access = `plain['${propName}']`;
      const transformDec = p.decorators.find((d) => d.name === "Transform");
      bodyLines.push(`if (${access} !== undefined) {`);
      if (transformDec) {
        bodyLines.push(`  instance['${propName}'] = ${access};`);
      } else {
        if (p.isArray) {
          if (p.items && p.items.typeName) {
            bodyLines.push(`  if (Array.isArray(${access})) {`);
            bodyLines.push(`    instance['${propName}'] = ${access}.map(item => validators.plainToInstance(classRefs['${propName}'], item));`);
            bodyLines.push(`  } else { instance['${propName}'] = []; }`);
          } else {
            bodyLines.push(`  instance['${propName}'] = ${access};`);
          }
        } else if (p.type === Number || typeof p.type === "string" && p.type.toLowerCase() === "number") {
          bodyLines.push(`  instance['${propName}'] = Number(${access});`);
        } else if (p.type === String || typeof p.type === "string" && p.type.toLowerCase() === "string") {
          bodyLines.push(`  instance['${propName}'] = String(${access});`);
        } else if (p.type === Boolean || typeof p.type === "string" && p.type.toLowerCase() === "boolean") {
          bodyLines.push(`  instance['${propName}'] = Boolean(${access});`);
        } else if (p.isClass) {
          bodyLines.push(`  instance['${propName}'] = validators.plainToInstance(classRefs['${propName}'], ${access});`);
        } else {
          bodyLines.push(`  instance['${propName}'] = ${access};`);
        }
      }
      bodyLines.push("}");
    }
    bodyLines.push("return instance;");
    const fn = new Function("plain", "Target", "classRefs", "validators", bodyLines.join(`
`));
    const classRefs = {};
    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop;
      if (p.isClass) {
        classRefs[propName] = p.type;
      }
      if (p.isArray && p.items && typeof p.items.typeName !== "string") {
        classRefs[propName] = p.items.typeName;
      }
    }
    const closure = (plain) => {
      return fn(plain, target, classRefs, {
        plainToInstance: (t, v) => TransformerCompiler.compilePlainToInstance(t)(v)
      });
    };
    this.p2iCache.set(target, closure);
    return closure;
  }
  static compileInstanceToPlain(target) {
    if (this.i2pCache.has(target)) {
      return this.i2pCache.get(target);
    }
    const metadata = MetadataConsumer.getCombinedMetadata(target);
    const bodyLines = [];
    bodyLines.push("const plain = {};");
    for (const [propName, prop] of Object.entries(metadata.properties)) {
      const p = prop;
      const isHidden = p.decorators.some((d) => d.name === "Hidden" || d.name === "Exclude");
      if (!isHidden) {
        if (p.isClass || p.isArray && p.items && p.items.typeName) {
          bodyLines.push(`  if (instance['${propName}'] !== undefined) {`);
          bodyLines.push(`    plain['${propName}'] = converters.instanceToPlain(instance['${propName}'], classRefs['${propName}']);`);
          bodyLines.push("  }");
        } else {
          bodyLines.push(`  if (instance['${propName}'] !== undefined) plain['${propName}'] = instance['${propName}'];`);
        }
      }
    }
    bodyLines.push("return plain;");
    const fn = new Function("instance", "converters", "classRefs", bodyLines.join(`
`));
    const classRefs = {};
    for (const [propName, prop] of Object.entries(metadata.properties)) {
      if (prop.isClass)
        classRefs[propName] = prop.type;
      if (prop.isArray && prop.items?.typeName)
        classRefs[propName] = prop.items.typeName;
    }
    const converters = {
      instanceToPlain: (val, Target) => {
        if (!val)
          return val;
        if (Array.isArray(val)) {
          return val.map((v) => Target ? TransformerCompiler.compileInstanceToPlain(Target)(v) : v);
        }
        return Target ? TransformerCompiler.compileInstanceToPlain(Target)(val) : val;
      }
    };
    const closure = (instance) => fn(instance, converters, classRefs);
    this.i2pCache.set(target, closure);
    return closure;
  }
}
// ../node_modules/.bun/http-status-codes@2.3.0/node_modules/http-status-codes/build/es/legacy.js
var ACCEPTED = 202;
var BAD_GATEWAY = 502;
var BAD_REQUEST = 400;
var CONFLICT = 409;
var CONTINUE = 100;
var CREATED = 201;
var EXPECTATION_FAILED = 417;
var FORBIDDEN = 403;
var GATEWAY_TIMEOUT = 504;
var GONE = 410;
var HTTP_VERSION_NOT_SUPPORTED = 505;
var IM_A_TEAPOT = 418;
var INSUFFICIENT_SPACE_ON_RESOURCE = 419;
var INSUFFICIENT_STORAGE = 507;
var INTERNAL_SERVER_ERROR = 500;
var LENGTH_REQUIRED = 411;
var LOCKED = 423;
var METHOD_FAILURE = 420;
var METHOD_NOT_ALLOWED = 405;
var MOVED_PERMANENTLY = 301;
var MOVED_TEMPORARILY = 302;
var MULTI_STATUS = 207;
var MULTIPLE_CHOICES = 300;
var NETWORK_AUTHENTICATION_REQUIRED = 511;
var NO_CONTENT = 204;
var NON_AUTHORITATIVE_INFORMATION = 203;
var NOT_ACCEPTABLE = 406;
var NOT_FOUND = 404;
var NOT_IMPLEMENTED = 501;
var NOT_MODIFIED = 304;
var OK = 200;
var PARTIAL_CONTENT = 206;
var PAYMENT_REQUIRED = 402;
var PERMANENT_REDIRECT = 308;
var PRECONDITION_FAILED = 412;
var PRECONDITION_REQUIRED = 428;
var PROCESSING = 102;
var PROXY_AUTHENTICATION_REQUIRED = 407;
var REQUEST_HEADER_FIELDS_TOO_LARGE = 431;
var REQUEST_TIMEOUT = 408;
var REQUEST_TOO_LONG = 413;
var REQUEST_URI_TOO_LONG = 414;
var REQUESTED_RANGE_NOT_SATISFIABLE = 416;
var RESET_CONTENT = 205;
var SEE_OTHER = 303;
var SERVICE_UNAVAILABLE = 503;
var SWITCHING_PROTOCOLS = 101;
var TEMPORARY_REDIRECT = 307;
var TOO_MANY_REQUESTS = 429;
var UNAUTHORIZED = 401;
var UNPROCESSABLE_ENTITY = 422;
var UNSUPPORTED_MEDIA_TYPE = 415;
var USE_PROXY = 305;
var legacy_default = {
  ACCEPTED,
  BAD_GATEWAY,
  BAD_REQUEST,
  CONFLICT,
  CONTINUE,
  CREATED,
  EXPECTATION_FAILED,
  FORBIDDEN,
  GATEWAY_TIMEOUT,
  GONE,
  HTTP_VERSION_NOT_SUPPORTED,
  IM_A_TEAPOT,
  INSUFFICIENT_SPACE_ON_RESOURCE,
  INSUFFICIENT_STORAGE,
  INTERNAL_SERVER_ERROR,
  LENGTH_REQUIRED,
  LOCKED,
  METHOD_FAILURE,
  METHOD_NOT_ALLOWED,
  MOVED_PERMANENTLY,
  MOVED_TEMPORARILY,
  MULTI_STATUS,
  MULTIPLE_CHOICES,
  NETWORK_AUTHENTICATION_REQUIRED,
  NO_CONTENT,
  NON_AUTHORITATIVE_INFORMATION,
  NOT_ACCEPTABLE,
  NOT_FOUND,
  NOT_IMPLEMENTED,
  NOT_MODIFIED,
  OK,
  PARTIAL_CONTENT,
  PAYMENT_REQUIRED,
  PERMANENT_REDIRECT,
  PRECONDITION_FAILED,
  PRECONDITION_REQUIRED,
  PROCESSING,
  PROXY_AUTHENTICATION_REQUIRED,
  REQUEST_HEADER_FIELDS_TOO_LARGE,
  REQUEST_TIMEOUT,
  REQUEST_TOO_LONG,
  REQUEST_URI_TOO_LONG,
  REQUESTED_RANGE_NOT_SATISFIABLE,
  RESET_CONTENT,
  SEE_OTHER,
  SERVICE_UNAVAILABLE,
  SWITCHING_PROTOCOLS,
  TEMPORARY_REDIRECT,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY,
  UNSUPPORTED_MEDIA_TYPE,
  USE_PROXY
};

// ../node_modules/.bun/http-status-codes@2.3.0/node_modules/http-status-codes/build/es/utils.js
var statusCodeToReasonPhrase = {
  "202": "Accepted",
  "502": "Bad Gateway",
  "400": "Bad Request",
  "409": "Conflict",
  "100": "Continue",
  "201": "Created",
  "417": "Expectation Failed",
  "424": "Failed Dependency",
  "403": "Forbidden",
  "504": "Gateway Timeout",
  "410": "Gone",
  "505": "HTTP Version Not Supported",
  "418": "I'm a teapot",
  "419": "Insufficient Space on Resource",
  "507": "Insufficient Storage",
  "500": "Internal Server Error",
  "411": "Length Required",
  "423": "Locked",
  "420": "Method Failure",
  "405": "Method Not Allowed",
  "301": "Moved Permanently",
  "302": "Moved Temporarily",
  "207": "Multi-Status",
  "300": "Multiple Choices",
  "511": "Network Authentication Required",
  "204": "No Content",
  "203": "Non Authoritative Information",
  "406": "Not Acceptable",
  "404": "Not Found",
  "501": "Not Implemented",
  "304": "Not Modified",
  "200": "OK",
  "206": "Partial Content",
  "402": "Payment Required",
  "308": "Permanent Redirect",
  "412": "Precondition Failed",
  "428": "Precondition Required",
  "102": "Processing",
  "103": "Early Hints",
  "426": "Upgrade Required",
  "407": "Proxy Authentication Required",
  "431": "Request Header Fields Too Large",
  "408": "Request Timeout",
  "413": "Request Entity Too Large",
  "414": "Request-URI Too Long",
  "416": "Requested Range Not Satisfiable",
  "205": "Reset Content",
  "303": "See Other",
  "503": "Service Unavailable",
  "101": "Switching Protocols",
  "307": "Temporary Redirect",
  "429": "Too Many Requests",
  "401": "Unauthorized",
  "451": "Unavailable For Legal Reasons",
  "422": "Unprocessable Entity",
  "415": "Unsupported Media Type",
  "305": "Use Proxy",
  "421": "Misdirected Request"
};
var reasonPhraseToStatusCode = {
  Accepted: 202,
  "Bad Gateway": 502,
  "Bad Request": 400,
  Conflict: 409,
  Continue: 100,
  Created: 201,
  "Expectation Failed": 417,
  "Failed Dependency": 424,
  Forbidden: 403,
  "Gateway Timeout": 504,
  Gone: 410,
  "HTTP Version Not Supported": 505,
  "I'm a teapot": 418,
  "Insufficient Space on Resource": 419,
  "Insufficient Storage": 507,
  "Internal Server Error": 500,
  "Length Required": 411,
  Locked: 423,
  "Method Failure": 420,
  "Method Not Allowed": 405,
  "Moved Permanently": 301,
  "Moved Temporarily": 302,
  "Multi-Status": 207,
  "Multiple Choices": 300,
  "Network Authentication Required": 511,
  "No Content": 204,
  "Non Authoritative Information": 203,
  "Not Acceptable": 406,
  "Not Found": 404,
  "Not Implemented": 501,
  "Not Modified": 304,
  OK: 200,
  "Partial Content": 206,
  "Payment Required": 402,
  "Permanent Redirect": 308,
  "Precondition Failed": 412,
  "Precondition Required": 428,
  Processing: 102,
  "Early Hints": 103,
  "Upgrade Required": 426,
  "Proxy Authentication Required": 407,
  "Request Header Fields Too Large": 431,
  "Request Timeout": 408,
  "Request Entity Too Large": 413,
  "Request-URI Too Long": 414,
  "Requested Range Not Satisfiable": 416,
  "Reset Content": 205,
  "See Other": 303,
  "Service Unavailable": 503,
  "Switching Protocols": 101,
  "Temporary Redirect": 307,
  "Too Many Requests": 429,
  Unauthorized: 401,
  "Unavailable For Legal Reasons": 451,
  "Unprocessable Entity": 422,
  "Unsupported Media Type": 415,
  "Use Proxy": 305,
  "Misdirected Request": 421
};

// ../node_modules/.bun/http-status-codes@2.3.0/node_modules/http-status-codes/build/es/utils-functions.js
function getReasonPhrase(statusCode) {
  var result = statusCodeToReasonPhrase[statusCode.toString()];
  if (!result) {
    throw new Error("Status code does not exist: " + statusCode);
  }
  return result;
}
function getStatusCode(reasonPhrase) {
  var result = reasonPhraseToStatusCode[reasonPhrase];
  if (!result) {
    throw new Error("Reason phrase does not exist: " + reasonPhrase);
  }
  return result;
}
var getStatusText = getReasonPhrase;

// ../node_modules/.bun/http-status-codes@2.3.0/node_modules/http-status-codes/build/es/status-codes.js
var StatusCodes;
(function(StatusCodes2) {
  StatusCodes2[StatusCodes2["CONTINUE"] = 100] = "CONTINUE";
  StatusCodes2[StatusCodes2["SWITCHING_PROTOCOLS"] = 101] = "SWITCHING_PROTOCOLS";
  StatusCodes2[StatusCodes2["PROCESSING"] = 102] = "PROCESSING";
  StatusCodes2[StatusCodes2["EARLY_HINTS"] = 103] = "EARLY_HINTS";
  StatusCodes2[StatusCodes2["OK"] = 200] = "OK";
  StatusCodes2[StatusCodes2["CREATED"] = 201] = "CREATED";
  StatusCodes2[StatusCodes2["ACCEPTED"] = 202] = "ACCEPTED";
  StatusCodes2[StatusCodes2["NON_AUTHORITATIVE_INFORMATION"] = 203] = "NON_AUTHORITATIVE_INFORMATION";
  StatusCodes2[StatusCodes2["NO_CONTENT"] = 204] = "NO_CONTENT";
  StatusCodes2[StatusCodes2["RESET_CONTENT"] = 205] = "RESET_CONTENT";
  StatusCodes2[StatusCodes2["PARTIAL_CONTENT"] = 206] = "PARTIAL_CONTENT";
  StatusCodes2[StatusCodes2["MULTI_STATUS"] = 207] = "MULTI_STATUS";
  StatusCodes2[StatusCodes2["MULTIPLE_CHOICES"] = 300] = "MULTIPLE_CHOICES";
  StatusCodes2[StatusCodes2["MOVED_PERMANENTLY"] = 301] = "MOVED_PERMANENTLY";
  StatusCodes2[StatusCodes2["MOVED_TEMPORARILY"] = 302] = "MOVED_TEMPORARILY";
  StatusCodes2[StatusCodes2["SEE_OTHER"] = 303] = "SEE_OTHER";
  StatusCodes2[StatusCodes2["NOT_MODIFIED"] = 304] = "NOT_MODIFIED";
  StatusCodes2[StatusCodes2["USE_PROXY"] = 305] = "USE_PROXY";
  StatusCodes2[StatusCodes2["TEMPORARY_REDIRECT"] = 307] = "TEMPORARY_REDIRECT";
  StatusCodes2[StatusCodes2["PERMANENT_REDIRECT"] = 308] = "PERMANENT_REDIRECT";
  StatusCodes2[StatusCodes2["BAD_REQUEST"] = 400] = "BAD_REQUEST";
  StatusCodes2[StatusCodes2["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
  StatusCodes2[StatusCodes2["PAYMENT_REQUIRED"] = 402] = "PAYMENT_REQUIRED";
  StatusCodes2[StatusCodes2["FORBIDDEN"] = 403] = "FORBIDDEN";
  StatusCodes2[StatusCodes2["NOT_FOUND"] = 404] = "NOT_FOUND";
  StatusCodes2[StatusCodes2["METHOD_NOT_ALLOWED"] = 405] = "METHOD_NOT_ALLOWED";
  StatusCodes2[StatusCodes2["NOT_ACCEPTABLE"] = 406] = "NOT_ACCEPTABLE";
  StatusCodes2[StatusCodes2["PROXY_AUTHENTICATION_REQUIRED"] = 407] = "PROXY_AUTHENTICATION_REQUIRED";
  StatusCodes2[StatusCodes2["REQUEST_TIMEOUT"] = 408] = "REQUEST_TIMEOUT";
  StatusCodes2[StatusCodes2["CONFLICT"] = 409] = "CONFLICT";
  StatusCodes2[StatusCodes2["GONE"] = 410] = "GONE";
  StatusCodes2[StatusCodes2["LENGTH_REQUIRED"] = 411] = "LENGTH_REQUIRED";
  StatusCodes2[StatusCodes2["PRECONDITION_FAILED"] = 412] = "PRECONDITION_FAILED";
  StatusCodes2[StatusCodes2["REQUEST_TOO_LONG"] = 413] = "REQUEST_TOO_LONG";
  StatusCodes2[StatusCodes2["REQUEST_URI_TOO_LONG"] = 414] = "REQUEST_URI_TOO_LONG";
  StatusCodes2[StatusCodes2["UNSUPPORTED_MEDIA_TYPE"] = 415] = "UNSUPPORTED_MEDIA_TYPE";
  StatusCodes2[StatusCodes2["REQUESTED_RANGE_NOT_SATISFIABLE"] = 416] = "REQUESTED_RANGE_NOT_SATISFIABLE";
  StatusCodes2[StatusCodes2["EXPECTATION_FAILED"] = 417] = "EXPECTATION_FAILED";
  StatusCodes2[StatusCodes2["IM_A_TEAPOT"] = 418] = "IM_A_TEAPOT";
  StatusCodes2[StatusCodes2["INSUFFICIENT_SPACE_ON_RESOURCE"] = 419] = "INSUFFICIENT_SPACE_ON_RESOURCE";
  StatusCodes2[StatusCodes2["METHOD_FAILURE"] = 420] = "METHOD_FAILURE";
  StatusCodes2[StatusCodes2["MISDIRECTED_REQUEST"] = 421] = "MISDIRECTED_REQUEST";
  StatusCodes2[StatusCodes2["UNPROCESSABLE_ENTITY"] = 422] = "UNPROCESSABLE_ENTITY";
  StatusCodes2[StatusCodes2["LOCKED"] = 423] = "LOCKED";
  StatusCodes2[StatusCodes2["FAILED_DEPENDENCY"] = 424] = "FAILED_DEPENDENCY";
  StatusCodes2[StatusCodes2["UPGRADE_REQUIRED"] = 426] = "UPGRADE_REQUIRED";
  StatusCodes2[StatusCodes2["PRECONDITION_REQUIRED"] = 428] = "PRECONDITION_REQUIRED";
  StatusCodes2[StatusCodes2["TOO_MANY_REQUESTS"] = 429] = "TOO_MANY_REQUESTS";
  StatusCodes2[StatusCodes2["REQUEST_HEADER_FIELDS_TOO_LARGE"] = 431] = "REQUEST_HEADER_FIELDS_TOO_LARGE";
  StatusCodes2[StatusCodes2["UNAVAILABLE_FOR_LEGAL_REASONS"] = 451] = "UNAVAILABLE_FOR_LEGAL_REASONS";
  StatusCodes2[StatusCodes2["INTERNAL_SERVER_ERROR"] = 500] = "INTERNAL_SERVER_ERROR";
  StatusCodes2[StatusCodes2["NOT_IMPLEMENTED"] = 501] = "NOT_IMPLEMENTED";
  StatusCodes2[StatusCodes2["BAD_GATEWAY"] = 502] = "BAD_GATEWAY";
  StatusCodes2[StatusCodes2["SERVICE_UNAVAILABLE"] = 503] = "SERVICE_UNAVAILABLE";
  StatusCodes2[StatusCodes2["GATEWAY_TIMEOUT"] = 504] = "GATEWAY_TIMEOUT";
  StatusCodes2[StatusCodes2["HTTP_VERSION_NOT_SUPPORTED"] = 505] = "HTTP_VERSION_NOT_SUPPORTED";
  StatusCodes2[StatusCodes2["INSUFFICIENT_STORAGE"] = 507] = "INSUFFICIENT_STORAGE";
  StatusCodes2[StatusCodes2["NETWORK_AUTHENTICATION_REQUIRED"] = 511] = "NETWORK_AUTHENTICATION_REQUIRED";
})(StatusCodes || (StatusCodes = {}));
// ../node_modules/.bun/http-status-codes@2.3.0/node_modules/http-status-codes/build/es/index.js
var __assign = function() {
  __assign = Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length;i < n; i++) {
      s = arguments[i];
      for (var p in s)
        if (Object.prototype.hasOwnProperty.call(s, p))
          t[p] = s[p];
    }
    return t;
  };
  return __assign.apply(this, arguments);
};
var es_default = __assign(__assign({}, legacy_default), {
  getStatusCode,
  getStatusText
});
// ../packages/http-server/src/decorators/method.decorator.ts
function createHttpMethodDecorator(method) {
  return function(pathOrOptions, options) {
    let path = "/";
    if (typeof pathOrOptions === "string") {
      path = pathOrOptions;
    } else if (pathOrOptions && typeof pathOrOptions === "object") {
      options = pathOrOptions;
    }
    return (value, context) => {
      if (context.kind !== "method") {
        throw new Error(`@${method} must be used on a method. Used on: ${context.kind}`);
      }
      MetadataStorage.addDecoratorMetadata(context, {
        name: method,
        arguments: [path],
        options
      });
      return value;
    };
  };
}
var Get = createHttpMethodDecorator("Get");
var Post = createHttpMethodDecorator("Post");
var Put = createHttpMethodDecorator("Put");
var Delete = createHttpMethodDecorator("Delete");
var Patch = createHttpMethodDecorator("Patch");
var Options = createHttpMethodDecorator("Options");
var Head = createHttpMethodDecorator("Head");
// ../packages/http-server/src/decorators/class.decorator.ts
function RestController(_path, _options) {
  return (value, context) => {
    if (context.kind !== "class") {
      throw new Error(`@RestController must be used on a class. Used on: ${context.kind}`);
    }
    return value;
  };
}
// ../packages/http-server/src/decorators/parameter.decorator.ts
var Body = () => () => {};
var Params = () => () => {};
// ../packages/http-server/src/decorators/constants.ts
var METADATA_KEY_PREFIX2 = "b:hs:";

// ../packages/http-server/src/decorators/enums.ts
var MetadataKey2;
((MetadataKey3) => {
  MetadataKey3["RestController"] = `${METADATA_KEY_PREFIX2}rc`;
  MetadataKey3["RouteHandler"] = `${METADATA_KEY_PREFIX2}rh`;
  MetadataKey3["RouteHandlerParams"] = `${METADATA_KEY_PREFIX2}rhp`;
})(MetadataKey2 ||= {});
// ../packages/http-server/src/enums.ts
var HttpMethod;
((HttpMethod2) => {
  HttpMethod2[HttpMethod2["Get"] = 0] = "Get";
  HttpMethod2[HttpMethod2["Post"] = 1] = "Post";
  HttpMethod2[HttpMethod2["Put"] = 2] = "Put";
  HttpMethod2[HttpMethod2["Patch"] = 3] = "Patch";
  HttpMethod2[HttpMethod2["Delete"] = 4] = "Delete";
  HttpMethod2[HttpMethod2["Head"] = 5] = "Head";
  HttpMethod2[HttpMethod2["Options"] = 6] = "Options";
})(HttpMethod ||= {});

// ../packages/http-server/src/errors/errors.ts
class HttpError extends Error {
  statusCode;
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
class MethodNotAllowedError extends HttpError {
  constructor(message = "Method Not Allowed") {
    super(StatusCodes.METHOD_NOT_ALLOWED, message);
  }
}
// ../packages/http-server/src/utils/ip.ts
function getIps(request, server, trustProxy) {
  const shouldTrustProxy = trustProxy ?? false;
  const headers = request.headers;
  const socketAddress = server.requestIP(request) ?? undefined;
  const forwardedIps = shouldTrustProxy ? collectForwardedFor(headers.get("forwarded" /* Forwarded */)) : [];
  const xForwardedForIps = shouldTrustProxy ? collectXForwardedFor(headers.get("x-forwarded-for" /* XForwardedFor */)) : [];
  const dedupedForwardChain = dedupePreserveOrder([...forwardedIps, ...xForwardedForIps]);
  const xRealIp = shouldTrustProxy ? extractHeaderIp(headers.get("x-real-ip" /* XRealIp */)) : undefined;
  const socketIp = sanitizeIpCandidate(socketAddress?.address);
  const ipCandidates = [
    dedupedForwardChain[0],
    xRealIp,
    socketIp && isIpAddress(socketIp) ? socketIp : undefined
  ];
  const ip = ipCandidates.find((candidate) => Boolean(candidate));
  return {
    ip,
    ips: dedupedForwardChain.length > 0 ? dedupedForwardChain : undefined
  };
}
function collectForwardedFor(headerValue) {
  if (!headerValue) {
    return [];
  }
  const results = [];
  for (const entry of headerValue.split(",")) {
    const element = entry.trim();
    if (!element) {
      continue;
    }
    for (const segment of element.split(";")) {
      const separator = segment.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const key = segment.slice(0, separator).trim().toLowerCase();
      if (key !== "for") {
        continue;
      }
      const value = segment.slice(separator + 1);
      const ip = extractHeaderIp(value);
      if (ip) {
        results.push(ip);
      }
    }
  }
  return results;
}
function collectXForwardedFor(headerValue) {
  if (!headerValue) {
    return [];
  }
  const results = [];
  for (const token of headerValue.split(",")) {
    const ip = extractHeaderIp(token);
    if (ip) {
      results.push(ip);
    }
  }
  return results;
}
function dedupePreserveOrder(values) {
  const seen = new Set;
  const result = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}
function extractHeaderIp(raw) {
  const candidate = sanitizeIpCandidate(raw);
  if (!candidate || !isIpAddress(candidate)) {
    return;
  }
  return candidate;
}
function sanitizeIpCandidate(raw) {
  if (!raw) {
    return;
  }
  let value = raw.trim();
  if (!value) {
    return;
  }
  const isPlaceholder = (candidate) => {
    const lower = candidate.toLowerCase();
    return lower === "unknown" || lower === "obfuscated" || lower === "none" || candidate.startsWith("_");
  };
  value = stripOptionalQuotes(value);
  if (!value || isPlaceholder(value)) {
    return;
  }
  if (value.startsWith("[")) {
    const closing = value.indexOf("]");
    if (closing > 0) {
      value = value.slice(1, closing);
    } else {
      value = value.slice(1);
    }
  }
  if (value.toLowerCase().startsWith("::ffff:")) {
    value = value.slice(7);
  }
  value = stripPortSuffix(value);
  value = stripOptionalQuotes(value);
  value = value.trim();
  if (!value || isPlaceholder(value)) {
    return;
  }
  return value;
}
function stripOptionalQuotes(value) {
  let result = value.trim();
  while (result.length >= 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if (first === '"' && last === '"' || first === "'" && last === "'") {
      result = result.slice(1, -1);
      result = result.replace(/\\([\\"'])/g, "$1");
      result = result.trim();
      continue;
    }
    break;
  }
  return result;
}
function stripPortSuffix(value) {
  const colonMatches = value.match(/:/g);
  const colonCount = colonMatches ? colonMatches.length : 0;
  if (value.includes(".") && colonCount === 1) {
    return value.slice(0, value.lastIndexOf(":"));
  }
  if (colonCount > 1) {
    const idx = value.lastIndexOf(":");
    const trailing = value.slice(idx + 1);
    if (/^\d+$/.test(trailing)) {
      const candidate = value.slice(0, idx);
      if (!isIpv6(value) && isIpv6(candidate)) {
        return candidate;
      }
    }
  }
  return value;
}
function isIpAddress(value) {
  return isIpv4(value) || isIpv6(value);
}
function isIpv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
    if (!/^[0-9]+$/.test(part)) {
      return false;
    }
    const number = Number(part);
    if (number < 0 || number > 255) {
      return false;
    }
    if (part.length > 1 && part.startsWith("0")) {
      return false;
    }
    return true;
  });
}
function isIpv6(value) {
  if (!value.includes(":")) {
    return false;
  }
  const validChars = /^[0-9a-fA-F:]+$/;
  if (!validChars.test(value)) {
    return false;
  }
  const segments = value.split(":");
  if (segments.length > 8) {
    return false;
  }
  let emptyBlocks = 0;
  for (const segment of segments) {
    if (segment.length === 0) {
      emptyBlocks += 1;
      continue;
    }
    if (segment.length > 4) {
      return false;
    }
  }
  if (emptyBlocks > 2) {
    return false;
  }
  return true;
}
// ../packages/http-server/src/bunner-http-application.ts
class BunnerHttpServer extends BaseApplication {
  rootModuleFile;
  server;
  workerPool;
  logger = new Logger(BunnerHttpServer.name);
  constructor(rootModuleFile, options) {
    super();
    this.server = undefined;
    this.rootModuleFile = rootModuleFile;
    this.options = {
      ...{
        port: 5000,
        bodyLimit: 10 * 1024 * 1024,
        trustProxy: false
      },
      ...options
    };
    const currentUrl = import.meta.url;
    const isBundled = currentUrl.endsWith(".js");
    const workerScript = isBundled ? new URL("./bunner-http-worker.js", currentUrl) : new URL("./bunner-http-worker.ts", currentUrl);
    this.workerPool = new WorkerPool({
      script: workerScript,
      size: options.workers
    });
  }
  async init() {
    const sanitizedRootModuleFile = {
      path: this.rootModuleFile.path,
      className: this.rootModuleFile.className,
      manifestPath: this.rootModuleFile.manifestPath
    };
    await this.workerPool.init({
      rootModuleFile: sanitizedRootModuleFile,
      options: {
        logLevel: this.options.logLevel,
        workers: this.options.workers,
        queueCapacity: this.options.queueCapacity
      }
    });
    this.logger.info("\u2728 Bunner HTTP Server initialized");
  }
  async start() {
    await this.workerPool.bootstrap();
    this.server = Bun.serve({
      port: this.options.port,
      maxRequestBodySize: this.options.bodyLimit,
      fetch: async (req) => {
        try {
          const normalizedHttpMethod = capitalize(req.method.toUpperCase());
          const httpMethod = HttpMethod[normalizedHttpMethod];
          if (httpMethod === undefined) {
            throw new MethodNotAllowedError;
          }
          let body;
          if (httpMethod === 0 /* Get */ || httpMethod === 4 /* Delete */ || httpMethod === 5 /* Head */ || httpMethod === 6 /* Options */) {
            body = undefined;
          } else {
            body = await req.text();
          }
          const { ip: ip2, ips } = getIps(req, this.server, this.options.trustProxy);
          const workerRes = await this.workerPool.call("handleRequest", {
            httpMethod,
            url: req.url,
            headers: req.headers.toJSON(),
            body,
            request: {
              ip: ip2,
              ips,
              isTrustedProxy: this.options.trustProxy
            }
          });
          if (!workerRes) {
            return new Response("Internal server error", {
              status: StatusCodes.INTERNAL_SERVER_ERROR
            });
          }
          return new Response(workerRes.body, workerRes.init);
        } catch (e) {
          this.logger.error("Fetch Error", e);
          return new Response("Internal server error", {
            status: StatusCodes.INTERNAL_SERVER_ERROR
          });
        }
      }
    });
  }
  async shutdown(force = false) {
    this.logger.info("\uD83D\uDED1 HTTP Server is shutting down...");
    await this.workerPool.destroy();
    await this.server?.stop(force);
  }
}
// src/posts/comments/comments.repository.ts
class CommentRepository {
  comments = [
    {
      id: 1,
      postId: 1,
      content: "Comment 1"
    },
    {
      id: 2,
      postId: 1,
      content: "Comment 2"
    }
  ];
  findAll() {
    return this.comments;
  }
  findOneById(id) {
    return this.comments.find((comment) => comment.id === id);
  }
  create(postId, body) {
    this.comments.push({
      id: this.comments.length + 1,
      postId,
      content: body.content
    });
  }
}
CommentRepository = __legacyDecorateClassTS([
  Injectable()
], CommentRepository);

// src/posts/comments/comments.service.ts
class CommentsService {
  commentsRepo;
  constructor(commentsRepo) {
    this.commentsRepo = commentsRepo;
  }
  create(id, body) {
    return this.commentsRepo.create(id, body);
  }
}
CommentsService = __legacyDecorateClassTS([
  Injectable()
], CommentsService);

// src/posts/comments/comments.module.ts
class CommentsModule {
}
CommentsModule = __legacyDecorateClassTS([
  Module({
    controllers: [],
    providers: [CommentsService, CommentRepository],
    exports: [CommentsService]
  })
], CommentsModule);
// src/posts/posts.controller.ts
class PostsController {
  postsService;
  constructor(postsService) {
    this.postsService = postsService;
  }
  getAll() {
    return this.postsService.findAll();
  }
  getById(params) {
    const { id } = params;
    return this.postsService.findOneById(id);
  }
  create(body) {
    return this.postsService.create(body);
  }
  update(params, body) {
    const { id } = params;
    return this.postsService.update(id, body);
  }
  delete(params) {
    const { id } = params;
    return this.postsService.delete(id);
  }
  createComment(params, body) {
    const { id } = params;
    return this.postsService.createComment(id, body);
  }
}
__legacyDecorateClassTS([
  Get()
], PostsController.prototype, "getAll", null);
__legacyDecorateClassTS([
  Get(":id"),
  __legacyDecorateParamTS(0, Params())
], PostsController.prototype, "getById", null);
__legacyDecorateClassTS([
  Post(),
  __legacyDecorateParamTS(0, Body())
], PostsController.prototype, "create", null);
__legacyDecorateClassTS([
  Put(":id"),
  __legacyDecorateParamTS(0, Params()),
  __legacyDecorateParamTS(1, Body())
], PostsController.prototype, "update", null);
__legacyDecorateClassTS([
  Delete(":id"),
  __legacyDecorateParamTS(0, Params())
], PostsController.prototype, "delete", null);
__legacyDecorateClassTS([
  Post(":id/comments"),
  __legacyDecorateParamTS(0, Params()),
  __legacyDecorateParamTS(1, Body())
], PostsController.prototype, "createComment", null);
PostsController = __legacyDecorateClassTS([
  RestController("posts")
], PostsController);

// src/posts/posts.repository.ts
class PostsRepository {
  posts = [
    {
      id: 1,
      title: "Post 1",
      content: "Content 1"
    },
    {
      id: 2,
      title: "Post 2",
      content: "Content 2"
    }
  ];
  findAll() {
    return this.posts;
  }
  findOneById(id) {
    return this.posts.find((post) => post.id === id);
  }
  create(body) {
    return this.posts.push(body);
  }
  update(id, data) {
    return this.posts[this.posts.findIndex((post) => post.id === id)] = data;
  }
  delete(id) {
    return this.posts.splice(this.posts.findIndex((post) => post.id === id), 1);
  }
}
PostsRepository = __legacyDecorateClassTS([
  Injectable()
], PostsRepository);

// src/posts/posts.service.ts
class PostsService {
  postRepo;
  commentsService;
  logger;
  constructor(postRepo, commentsService, logger3) {
    this.postRepo = postRepo;
    this.commentsService = commentsService;
    this.logger = logger3;
    this.logger.debug("PostsService initialized");
  }
  findAll() {
    return this.postRepo.findAll();
  }
  findOneById(id) {
    return this.postRepo.findOneById(id);
  }
  create(body) {
    return this.postRepo.create(body);
  }
  update(id, data) {
    return this.postRepo.update(id, data);
  }
  delete(id) {
    return this.postRepo.delete(id);
  }
  createComment(id, body) {
    return this.commentsService.create(id, body);
  }
}
PostsService = __legacyDecorateClassTS([
  Injectable()
], PostsService);

// src/posts/posts.module.ts
class PostsModule {
}
PostsModule = __legacyDecorateClassTS([
  Module({
    imports: [CommentsModule],
    controllers: [PostsController],
    providers: [PostsService, PostsRepository]
  })
], PostsModule);
// src/users/dto/complex.dto.ts
class AddressDto {
}
__legacyDecorateClassTS([
  IsString()
], AddressDto.prototype, "street", undefined);
__legacyDecorateClassTS([
  IsNumber()
], AddressDto.prototype, "zipCode", undefined);
__legacyDecorateClassTS([
  IsBoolean()
], AddressDto.prototype, "isBusiness", undefined);

class SocialDto {
}
__legacyDecorateClassTS([
  IsIn(["twitter", "github", "linkedin"])
], SocialDto.prototype, "platform", undefined);
__legacyDecorateClassTS([
  IsString()
], SocialDto.prototype, "url", undefined);

class CreateUserComplexDto {
}
__legacyDecorateClassTS([
  IsString()
], CreateUserComplexDto.prototype, "name", undefined);
__legacyDecorateClassTS([
  Min(18),
  Max(99)
], CreateUserComplexDto.prototype, "age", undefined);
__legacyDecorateClassTS([
  ValidateNested()
], CreateUserComplexDto.prototype, "addresses", undefined);
__legacyDecorateClassTS([
  ValidateNested()
], CreateUserComplexDto.prototype, "social", undefined);
__legacyDecorateClassTS([
  IsArray()
], CreateUserComplexDto.prototype, "tags", undefined);
__legacyDecorateClassTS([
  IsOptional(),
  IsString()
], CreateUserComplexDto.prototype, "bio", undefined);

// src/users/users.controller.ts
class UsersController {
  usersService;
  logger = new Logger(UsersController);
  constructor(usersService) {
    this.usersService = usersService;
  }
  getAll() {
    return this.usersService.findAll();
  }
  complexCreate(body) {
    this.logger.info("Complex Data Received:", body);
    return {
      message: "Validated and Transformed!",
      data: body,
      isNameString: typeof body.name === "string",
      isAgeNumber: typeof body.age === "number",
      isAddressInstance: body.addresses?.[0] instanceof AddressDto,
      isSocialInstance: body.social instanceof SocialDto
    };
  }
  getById(params) {
    const { id } = params;
    return this.usersService.findOneById(id);
  }
  create(body) {
    return this.usersService.create(body);
  }
  update(params, body) {
    const { id } = params;
    return this.usersService.update(id, body);
  }
  delete(params) {
    const { id } = params;
    return this.usersService.delete(id);
  }
}
__legacyDecorateClassTS([
  Get()
], UsersController.prototype, "getAll", null);
__legacyDecorateClassTS([
  Post("complex"),
  __legacyDecorateParamTS(0, Body())
], UsersController.prototype, "complexCreate", null);
__legacyDecorateClassTS([
  Get(":id"),
  __legacyDecorateParamTS(0, Params())
], UsersController.prototype, "getById", null);
__legacyDecorateClassTS([
  Post(),
  __legacyDecorateParamTS(0, Body())
], UsersController.prototype, "create", null);
__legacyDecorateClassTS([
  Put(":id"),
  __legacyDecorateParamTS(0, Params()),
  __legacyDecorateParamTS(1, Body())
], UsersController.prototype, "update", null);
__legacyDecorateClassTS([
  Delete(":id"),
  __legacyDecorateParamTS(0, Params())
], UsersController.prototype, "delete", null);
UsersController = __legacyDecorateClassTS([
  RestController("users")
], UsersController);

// src/users/users.repository.ts
class UserRepository {
  users = [
    { id: 1, name: "John Doe" },
    { id: 2, name: "Jane Doe" },
    { id: 3, name: "John Smith" },
    { id: 4, name: "Jane Smith" },
    { id: 5, name: "John Doe" },
    { id: 6, name: "Jane Doe" },
    { id: 7, name: "John Smith" },
    { id: 8, name: "Jane Smith" },
    { id: 9, name: "John Doe" },
    { id: 10, name: "Jane Doe" },
    { id: 11, name: "John Smith" },
    { id: 12, name: "Jane Smith" },
    { id: 13, name: "John Doe" },
    { id: 14, name: "Jane Doe" },
    { id: 15, name: "John Smith" },
    { id: 16, name: "Jane Smith" }
  ];
  findAll() {
    return this.users;
  }
  findOneById(id) {
    return this.users.find((user) => user.id === id);
  }
  create(data) {
    this.users.push(data);
  }
  updateById(id, data) {
    this.users[this.users.findIndex((user) => user.id === id)] = data;
  }
  deleteById(id) {
    this.users.splice(this.users.findIndex((user) => user.id === id), 1);
  }
}
UserRepository = __legacyDecorateClassTS([
  Injectable()
], UserRepository);

// src/users/users.service.ts
class UsersService {
  userRepository;
  logger;
  constructor(userRepository, logger3) {
    this.userRepository = userRepository;
    this.logger = logger3;
    this.logger.debug("UsersService initialized");
  }
  findAll() {
    return this.userRepository.findAll();
  }
  findOneById(id) {
    return this.userRepository.findOneById(id);
  }
  create(body) {
    this.logger.info("Creating user", body);
    this.userRepository.create(body);
  }
  update(id, data) {
    this.userRepository.updateById(id, data);
  }
  delete(id) {
    this.userRepository.deleteById(id);
  }
}
UsersService = __legacyDecorateClassTS([
  Injectable()
], UsersService);

// src/users/users.module.ts
class UsersModule {
}
UsersModule = __legacyDecorateClassTS([
  Module({
    controllers: [UsersController],
    providers: [UsersService, UserRepository],
    exports: [UsersService]
  })
], UsersModule);
// src/app.module.ts
var __filename = "/Users/pjh/Desktop/bunner/examples/src/app.module.ts";
class AppModule {
  logger;
  constructor(logger3) {
    this.logger = logger3;
    this.logger.info("AppModule initialized");
  }
}
AppModule = __legacyDecorateClassTS([
  RootModule({
    path: __filename,
    imports: [UsersModule, PostsModule]
  })
], AppModule);

// src/main.ts
async function bootstrap() {
  const logger3 = new Logger("Bootstrap");
  const app = await Bunner.create(BunnerHttpServer, AppModule, {
    logLevel: 1 /* Debug */,
    workers: 1,
    queueCapacity: 8192,
    port: 5001
  });
  logger3.info("\uD83D\uDE80 Server is starting...");
  await app.start();
  logger3.info("\uD83D\uDE80 Server is running on port 5001");
  setInterval(() => {
    const mem = process.memoryUsage();
    logger3.debug(`rss: ${(mem.rss / 1024 / 1024).toFixed(2)}MB, heapTotal: ${(mem.heapTotal / 1024 / 1024).toFixed(2)}MB, heapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }, 5000);
}
bootstrap().catch((err) => {
  const logger3 = new Logger("Bootstrap");
  logger3.error("Bootstrap error", err);
});
