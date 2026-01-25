const DOT_FILE_PATTERN = '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$';
const TS_DECLARATION_FILE_PATTERN = '\\.d\\.(c|m)?ts$';
const TS_CONFIG_FILE_PATTERN = '(^|/)tsconfig\\.json$';
const OTHER_CONFIG_FILES_PATTERN = '(^|/)(?:babel|webpack)\\.config\\.(?:js|cjs|mjs|ts|json)$';

const KNOWN_CONFIG_FILE_PATTERNS = [
  DOT_FILE_PATTERN,
  TS_DECLARATION_FILE_PATTERN,
  TS_CONFIG_FILE_PATTERN,
  OTHER_CONFIG_FILES_PATTERN,
].join('|');

module.exports = {
  forbidden: [
    {
      name: 'no-orphans',
      comment:
        "This is an orphan module - it's likely not used (anymore?). Either use it or " +
        'remove it. If it is logical this module is an orphan (i.e. it is a config file), ' +
        'add an exception for it in your dependency-cruiser configuration. By default ' +
        'this rule does not scrutinize dotfiles (e.g. .eslintrc.js), TypeScript declaration ' +
        'files (.d.ts/ .d.cts/ .d.mts), tsconfig.json and some of the babel and webpack configs.',
      severity: 'ignore',
      from: {
        orphan: true,
        pathNot: KNOWN_CONFIG_FILE_PATTERNS,
      },
      to: {},
    },
    {
      name: 'no-circular',
      comment:
        'This dependency is part of a circular relationship. You might want to revise ' +
        'your solution (i.e. use dependency inversion, make sure the modules have a ' +
        'single responsibility) ',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-deprecated-core',
      comment:
        'This module depends on a node core module that has been deprecated. Find an ' +
        "alternative - these are bound to exist - node doesn't deprecate lightly.",
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: '^(?:punycode|domain|constants|sys|_linklist|_stream_wrap)$',
      },
    },
    {
      name: 'no-duplicate-dep-types',
      comment:
        "Likely this module depends on an external ('npm') package that occurs more " +
        'than once in your package.json i.e. both as a devDependency and in dependencies. ' +
        'This will cause maintenance problems later on. If it is intentional, you can ' +
        'disable this rule by adding this override as a rule in the forbidden section ' +
        'of your dependency-cruiser configuration: ' +
        '{"name": "no-duplicate-dep-types", "severity": "ignore"}',
      severity: 'error',
      from: {},
      to: {
        moreThanOneDependencyType: true,
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'no-non-package-json',
      comment:
        "This module depends on an npm package that isn't in the 'dependencies' section " +
        'of your package.json. That is problematic as the package either (1) will not be ' +
        '(available on live (2 - worse) will be available on live with a non-guaranteed ' +
        'version. Fix it by adding the package to the dependencies in your package.json.',
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['npm-no-pkg', 'npm-unknown'],
      },
    },
    {
      name: 'not-to-deprecated',
      comment:
        'This module uses a (version of an) npm module that has been deprecated. Either ' +
        'upgrade to a later version of that module, or find an alternative. Deprecated ' +
        'modules are a security risk.',
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['deprecated'],
      },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        "This module depends on a module that cannot be found ('resolved to disk'). " +
        'If it is an npm module: add it to your package.json. In all other cases you ' +
        'likely already know what to do.',
      severity: 'error',
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg'],
    },
    includeOnly: {
      path: '^(packages|tooling|examples)(/|$)',
    },
    exclude: {
      path: '(^|/)(node_modules|\\.git|\\.husky|\\.bunner|dist|coverage)(/|$)',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
