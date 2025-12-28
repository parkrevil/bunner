type ParsedCommit = {
  readonly scope?: string;
};

type RuleWhen = 'always' | 'never';

type RuleResult = readonly [boolean, string?];

type Rule = (parsed: ParsedCommit, when: RuleWhen) => RuleResult;

const scopeNoMulti: Rule = (parsed, when) => {
  const scope = parsed.scope;

  if (!scope) {
    return [true];
  }

  const hasComma = scope.includes(',');

  if (when === 'always') {
    return [!hasComma, 'scope must be a single value (no commas)'];
  }

  if (when === 'never') {
    return [hasComma, 'scope must contain a comma'];
  }

  return [true];
};
const commitlintPlugin = {
  rules: {
    'scope-no-multi': scopeNoMulti,
  },
};

export default commitlintPlugin;
