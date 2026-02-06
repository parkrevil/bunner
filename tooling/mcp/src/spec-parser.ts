export type SpecIdentity = {
  title?: string;
  id?: string;
  version?: string;
  status?: string;
  owner?: string;
  uniquenessScope?: string;
  dependsOn: string[];
  supersedes?: string;
};

export type SpecRuleRow = {
  ruleId: string;
  lifecycle?: string;
  keyword?: string;
  targets?: string;
  targetRefs?: string;
  condition?: string;
  enforcedLevel?: string;
};

export type SpecDiagnosticRow = {
  ruleId?: string;
  violation?: string;
  diagnosticCode: string;
  severity?: string;
  where?: string;
  howDetectable?: string;
};

export type ParsedSpec = {
  identity: SpecIdentity;
  inScope: string[];
  outOfScope: string[];
  definitions: string[];
  externalTerms: Array<{ term: string; key: string; definedIn: string; notes?: string }>;
  rules: SpecRuleRow[];
  diagnostics: SpecDiagnosticRow[];
};

function splitTableRow(line: string): string[] {
  // expects markdown table rows like: | a | b | c |
  const trimmed = line.trim();
  const raw = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return raw.split('|').map((cell) => cell.trim());
}

function parseSimpleTable(lines: string[], startIndex: number): { header: string[]; rows: string[][]; nextIndex: number } {
  // Finds a header row "| ... |" then separator "| --- |" then row(s)
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (typeof line === 'string' && line.trim().startsWith('|')) break;
    i++;
  }
  if (i >= lines.length) return { header: [], rows: [], nextIndex: lines.length };

  const headerLine = lines[i];
  if (typeof headerLine !== 'string') return { header: [], rows: [], nextIndex: i + 1 };
  const header = splitTableRow(headerLine);
  i++;
  // separator
  if (i < lines.length) {
    const separatorLine = lines[i];
    if (typeof separatorLine === 'string' && separatorLine.trim().startsWith('|')) i++;
  }

  const rows: string[][] = [];
  while (i < lines.length) {
    const rawLine = lines[i];
    if (typeof rawLine !== 'string') {
      i++;
      continue;
    }
    const line = rawLine.trim();
    if (!line.startsWith('|')) break;
    // stop at an empty single-cell row sometimes? keep it anyway
    rows.push(splitTableRow(rawLine));
    i++;
  }

  return { header, rows, nextIndex: i };
}

function findHeadingIndex(lines: string[], headingPrefix: string): number {
  return lines.findIndex((line) => line.trim().startsWith(headingPrefix));
}

export function parseSpecMarkdown(markdown: string): ParsedSpec {
  const lines = markdown.split(/\r?\n/);

  // 0) Identity table (first markdown table after "## 0.")
  const identityIndex = lines.findIndex((l) => l.trim().startsWith('## 0.'));
  const identityTable = parseSimpleTable(lines, identityIndex === -1 ? 0 : identityIndex);

  const identity: SpecIdentity = { dependsOn: [] };
  for (const row of identityTable.rows) {
    const key = row[0];
    const value = row[1] ?? '';
    if (!key) continue;
    if (key.startsWith('Title')) identity.title = value;
    if (key === 'ID') identity.id = value;
    if (key.startsWith('Version')) identity.version = value;
    if (key.startsWith('Status')) identity.status = value;
    if (key.startsWith('Owner')) identity.owner = value;
    if (key.startsWith('Uniqueness Scope')) identity.uniquenessScope = value;
    if (key.startsWith('Depends-On')) {
      identity.dependsOn = value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v !== 'none');
    }
    if (key.startsWith('Supersedes') && value && value !== 'none') identity.supersedes = value;
  }

  // 1.1 / 1.2 scope lock tables
  const inScopeIdx = findHeadingIndex(lines, '### 1.1');
  const inScopeTable = parseSimpleTable(lines, inScopeIdx === -1 ? 0 : inScopeIdx);
  const inScope = inScopeTable.rows.map((r) => r[0]).filter((v): v is string => !!v && v !== 'none');

  const outScopeIdx = findHeadingIndex(lines, '### 1.2');
  const outScopeTable = parseSimpleTable(lines, outScopeIdx === -1 ? 0 : outScopeIdx);
  const outOfScope = outScopeTable.rows.map((r) => r[0]).filter((v): v is string => !!v && v !== 'none');

  // Definitions section (best-effort): collect TERM(...) lines under 1.3
  const definitions: string[] = [];
  const defIdx = findHeadingIndex(lines, '### 1.3');
  if (defIdx !== -1) {
    for (let i = defIdx + 1; i < Math.min(lines.length, defIdx + 60); i++) {
      const rawLine = lines[i];
      if (typeof rawLine !== 'string') continue;
      const line = rawLine.trim();
      if (line.startsWith('### 1.4')) break;
      if (line.startsWith('- `TERM(') || line.startsWith('- TERM(')) definitions.push(line);
    }
  }

  // External terms table 1.4
  const extIdx = findHeadingIndex(lines, '### 1.4');
  const extTable = parseSimpleTable(lines, extIdx === -1 ? 0 : extIdx);
  const externalTerms = extTable.rows
    .map((r) => {
      const term = r[0] ?? '';
      const key = r[1] ?? '';
      const definedIn = r[2] ?? '';
      const notes = r[3];
      return {
        term,
        key,
        definedIn,
        ...(notes ? { notes } : {}),
      };
    })
    .filter((r) => r.term && r.term !== 'none');

  // 3.3 Shape Rules table (find header containing "Rule ID")
  const shapeRulesIdx = lines.findIndex((l) => l.includes('### 3.3'));
  const rulesTable = parseSimpleTable(lines, shapeRulesIdx === -1 ? 0 : shapeRulesIdx);
  const header = rulesTable.header;
  const ruleIdIndex = header.findIndex((h) => h.includes('Rule ID'));
  const lifecycleIndex = header.findIndex((h) => h.includes('Lifecycle'));
  const keywordIndex = header.findIndex((h) => h.includes('Keyword'));
  const targetsIndex = header.findIndex((h) => h.includes('Targets'));
  const targetRefsIndex = header.findIndex((h) => h.includes('Target Ref'));
  const conditionIndex = header.findIndex((h) => h.includes('Condition'));
  const enforcedIndex = header.findIndex((h) => h.includes('Enforced Level'));

  const rules: SpecRuleRow[] = [];
  for (const row of rulesTable.rows) {
    const ruleId = row[ruleIdIndex] ?? '';
    if (!ruleId || ruleId === '[Spec ID]-R-001') continue;
    const out: SpecRuleRow = { ruleId };
    const lifecycle = lifecycleIndex >= 0 ? row[lifecycleIndex] : undefined;
    const keyword = keywordIndex >= 0 ? row[keywordIndex] : undefined;
    const targets = targetsIndex >= 0 ? row[targetsIndex] : undefined;
    const targetRefs = targetRefsIndex >= 0 ? row[targetRefsIndex] : undefined;
    const condition = conditionIndex >= 0 ? row[conditionIndex] : undefined;
    const enforcedLevel = enforcedIndex >= 0 ? row[enforcedIndex] : undefined;

    if (lifecycle) out.lifecycle = lifecycle;
    if (keyword) out.keyword = keyword;
    if (targets) out.targets = targets;
    if (targetRefs) out.targetRefs = targetRefs;
    if (condition) out.condition = condition;
    if (enforcedLevel) out.enforcedLevel = enforcedLevel;

    rules.push(out);
  }

  // 7 Diagnostics Mapping table
  const diagIdx = lines.findIndex((l) => l.trim().startsWith('## 7.'));
  const diagTable = parseSimpleTable(lines, diagIdx === -1 ? 0 : diagIdx);
  const diagHeader = diagTable.header;
  const diagRuleIndex = diagHeader.findIndex((h) => h.includes('Rule ID'));
  const violationIndex = diagHeader.findIndex((h) => h.includes('Violation'));
  const codeIndex = diagHeader.findIndex((h) => h.includes('Diagnostic Code'));
  const severityIndex = diagHeader.findIndex((h) => h.includes('Severity'));
  const whereIndex = diagHeader.findIndex((h) => h.includes('Where'));
  const howIndex = diagHeader.findIndex((h) => h.includes('How Detectable'));

  const diagnostics: SpecDiagnosticRow[] = [];
  for (const row of diagTable.rows) {
    const diagnosticCode = (codeIndex >= 0 ? row[codeIndex] : '') ?? '';
    if (!diagnosticCode) continue;
    if (diagnosticCode === '[code]') continue;
    const out: SpecDiagnosticRow = { diagnosticCode };
    const ruleId = diagRuleIndex >= 0 ? row[diagRuleIndex] : undefined;
    const violation = violationIndex >= 0 ? row[violationIndex] : undefined;
    const severity = severityIndex >= 0 ? row[severityIndex] : undefined;
    const where = whereIndex >= 0 ? row[whereIndex] : undefined;
    const howDetectable = howIndex >= 0 ? row[howIndex] : undefined;

    if (ruleId) out.ruleId = ruleId;
    if (violation) out.violation = violation;
    if (severity) out.severity = severity;
    if (where) out.where = where;
    if (howDetectable) out.howDetectable = howDetectable;

    diagnostics.push(out);
  }

  return {
    identity,
    inScope,
    outOfScope,
    definitions,
    externalTerms,
    rules,
    diagnostics,
  };
}
