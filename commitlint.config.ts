import commitlintPlugin from './commitlint';

const config = {
  extends: ['@commitlint/config-conventional'],
  plugins: [commitlintPlugin],
  rules: {
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
    'scope-case': [2, 'always', ['kebab-case']],
    'scope-no-multi': [2, 'always'],
    'scope-enum': [
      2,
      'always',
      ['cli', 'common', 'core', 'http-adapter', 'logger', 'scalar', 'examples', 'repo', 'config', 'plan', 'eslint', 'scripts'],
    ],
    'type-enum': [2, 'always', ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test']],
    'subject-case': [2, 'never', ['pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
  },
};

export default config;
