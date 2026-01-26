import path from 'node:path';

const CODE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs']);

const normalizePath = (value: string): string => value.replaceAll('\\', '/');

const isMarkdownFile = (filePath: string): boolean => path.extname(filePath) === '.md';

const isPlanFile = (filePath: string): boolean => {
  const normalized = normalizePath(filePath);

  return normalized.startsWith('plans/') && normalized.endsWith('.md');
};

const isTaskFile = (filePath: string): boolean => {
  const normalized = normalizePath(filePath);

  return normalized.startsWith('tasks/') && normalized.endsWith('.md');
};

const splitLines = (value: string): string[] => value.split(/\r?\n/g);

const extractFrontmatter = (contents: string): string | null => {
  if (!contents.startsWith('---')) {
    return null;
  }

  const endIndex = contents.indexOf('\n---', 3);

  if (endIndex === -1) {
    return null;
  }

  return contents.slice(0, endIndex + '\n---'.length);
};

const extractFrontmatterField = (frontmatter: string, key: string): string | null => {
  const re = new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm');
  const match = frontmatter.match(re);
  const rawValue = match?.[1];
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';

  return value.length > 0 ? value : null;
};

const extractFrontmatterListField = (frontmatter: string, key: string): string[] => {
  const lines = splitLines(frontmatter);
  const values: string[] = [];
  let inList = false;
  let baseIndent: number | null = null;

  for (const line of lines) {
    if (!inList) {
      const match = line.match(new RegExp(`^${key}:\\s*$`));

      if (match !== null) {
        inList = true;
      }

      continue;
    }

    if (line.trim() === '---') {
      break;
    }

    if (line.trim().length === 0) {
      continue;
    }

    baseIndent ??= line.match(/^\s*/)?.[0]?.length ?? 0;

    const currentIndent = line.match(/^\s*/)?.[0]?.length ?? 0;

    if (baseIndent !== null && currentIndent < baseIndent) {
      break;
    }

    const trimmed = line.trim();
    const itemMatch = trimmed.match(/^-\s+(.+)\s*$/);
    const raw = itemMatch?.[1];
    const candidate = typeof raw === 'string' ? raw.trim() : '';

    if (candidate.length === 0) {
      continue;
    }

    values.push(candidate.replace(/^['"]|['"]$/g, ''));
  }

  return values;
};

const stripFencedCodeBlocks = (contents: string): string => {
  const lines = splitLines(contents);
  const out: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('```')) {
      inFence = !inFence;

      continue;
    }

    if (!inFence) {
      out.push(line);
    }
  }

  return out.join('\n');
};

const isCodeFile = (filePath: string): boolean => CODE_EXTENSIONS.has(path.extname(filePath));

const findUnresolvedCheckboxes = (contents: string): string[] => {
  const lines = splitLines(contents);

  return lines
    .map((line, index) => ({ line, index }))
    .filter(entry => entry.line.includes('- [ ]'))
    .map(entry => `line ${entry.index + 1}: ${entry.line.trim()}`);
};

const findPlaceholders = (contents: string): string[] => {
  const stripped = stripFencedCodeBlocks(contents);
  const lines = splitLines(stripped);
  const placeholders: string[] = [];

  const matchesAll = (line: string, re: RegExp): string[] => {
    const results: string[] = [];
    const global = re.global ? re : new RegExp(re.source, `${re.flags}g`);

    for (const match of line.matchAll(global)) {
      const value = match[0];

      if (typeof value === 'string' && value.length > 0) {
        results.push(value);
      }
    }

    return results;
  };

  for (const [index, line] of lines.entries()) {
    for (const value of matchesAll(line, /\{\{[^\n}]+\}\}/g)) {
      placeholders.push(`line ${index + 1}: ${value}`);
    }

    for (const value of matchesAll(line, /<[^\n>]*\.\.\.[^\n>]*>/g)) {
      placeholders.push(`line ${index + 1}: ${value}`);
    }

    for (const value of matchesAll(line, /<[^\n>]*\|[^\n>]*>/g)) {
      placeholders.push(`line ${index + 1}: ${value}`);
    }

    if (line.includes('<...>')) {
      placeholders.push(`line ${index + 1}: <...>`);
    }

    if (line.includes('{원문 그대로}')) {
      placeholders.push(`line ${index + 1}: {원문 그대로}`);
    }

    if (line.includes('<무엇으로 확인?>')) {
      placeholders.push(`line ${index + 1}: <무엇으로 확인?>`);
    }

    if (line.includes('{...}')) {
      placeholders.push(`line ${index + 1}: {...}`);
    }
  }

  return placeholders;
};

const extractTaskPlanLink = (contents: string): string | null => {
  const match = contents.match(/plans\/[\S`]+\.md#Step-[0-9]+/);
  const value = match?.[0];

  return typeof value === 'string' && value.length > 0 ? value : null;
};

const parsePlanLink = (planLink: string): { planPath: string; stepNumber: number } | null => {
  const pieces = planLink.split('#');
  const planPath = pieces[0] ?? '';
  const anchor = pieces[1] ?? '';
  const match = anchor.match(/^Step-([0-9]+)$/);
  const rawStep = match?.[1];
  const stepNumber = typeof rawStep === 'string' ? Number(rawStep) : Number.NaN;

  if (!planPath.startsWith('plans/') || !planPath.endsWith('.md')) {
    return null;
  }

  if (!Number.isFinite(stepNumber) || stepNumber <= 0) {
    return null;
  }

  return { planPath, stepNumber };
};

const extractTaskAllowedPaths = (contents: string): string[] => {
  const lines = splitLines(contents);
  const patterns: string[] = [];
  let inAllowedPaths = false;

  for (const line of lines) {
    if (!inAllowedPaths) {
      if (line.includes('Allowed paths') && line.includes('(MUST')) {
        inAllowedPaths = true;
      }

      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      break;
    }

    if (
      trimmed.startsWith('- File → MUST IDs') ||
      trimmed.startsWith('- Public API impact') ||
      trimmed.startsWith('- Scope delta rule')
    ) {
      break;
    }

    const match = trimmed.match(/^[-*]\s+`([^`]+)`\s*$/);
    const matched = match?.[1];

    if (typeof matched === 'string' && matched.length > 0) {
      patterns.push(matched);

      continue;
    }

    const rawMatch = trimmed.match(/^[-*]\s+([^\s`].+)$/);
    const raw = rawMatch?.[1];

    if (typeof raw === 'string' && raw.length > 0) {
      patterns.push(raw.trim());
    }
  }

  return patterns;
};

const extractTaskMustIds = (contents: string): string[] => {
  const lines = splitLines(contents);
  const ids = new Set<string>();
  let inMustList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inMustList) {
      if (trimmed.startsWith('- MUST IDs covered by this Task')) {
        inMustList = true;
      }

      continue;
    }

    if (trimmed.startsWith('- Evidence IDs produced by this Task')) {
      break;
    }

    const match = trimmed.match(/^[-*]\s+(MUST-[0-9]+[a-z]?)\s*$/);
    const mustId = match?.[1];

    if (typeof mustId === 'string' && mustId.length > 0) {
      ids.add(mustId);
    }
  }

  return [...ids].sort();
};

const extractTaskFilesToChange = (contents: string): string[] => {
  const lines = splitLines(contents);
  const files: string[] = [];
  let inFiles = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFiles) {
      if (trimmed === '- Files to change (expected):') {
        inFiles = true;
      }

      continue;
    }

    if (trimmed.startsWith('- Files to read') || trimmed.startsWith('- Public API impact') || trimmed.startsWith('### ')) {
      break;
    }

    const match = trimmed.match(/^[-*]\s+`([^`]+)`\s*$/);
    const matched = match?.[1];

    if (typeof matched === 'string' && matched.length > 0) {
      files.push(matched);

      continue;
    }

    const rawMatch = trimmed.match(/^[-*]\s+([^\s`].+)$/);
    const raw = rawMatch?.[1];

    if (typeof raw === 'string' && raw.length > 0) {
      files.push(raw.trim());
    }
  }

  return [...new Set(files.map(normalizePath).filter(value => value.length > 0))];
};

const extractTaskFileMustMap = (contents: string): ReadonlyMap<string, readonly string[]> => {
  const lines = splitLines(contents);
  const map = new Map<string, string[]>();
  let inMapping = false;

  for (const line of lines) {
    if (!inMapping) {
      if (line.includes('File → MUST IDs') && line.includes('(MUST')) {
        inMapping = true;
      }

      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed.startsWith('- Public API impact')) {
      break;
    }

    const match = trimmed.match(/^[-*]\s+`?([^`]+?)`?\s*:\s*(.+)\s*$/);
    const rawFile = match?.[1];
    const rawIds = match?.[2];

    if (typeof rawFile !== 'string' || rawFile.trim().length === 0) {
      continue;
    }

    if (typeof rawIds !== 'string' || rawIds.trim().length === 0) {
      continue;
    }

    const filePath = normalizePath(rawFile.trim());
    const mustIds = rawIds
      .split(',')
      .map(value => value.trim())
      .filter(value => /^MUST-[0-9]+[a-z]?$/.test(value));

    if (mustIds.length === 0) {
      continue;
    }

    map.set(filePath, [...new Set(mustIds)].sort());
  }

  return map;
};

const extractPlanAllowedPaths = (contents: string): string[] => {
  const frontmatter = extractFrontmatter(contents);

  if (frontmatter === null) {
    return [];
  }

  return extractFrontmatterListField(frontmatter, 'allowed_paths')
    .map(value => normalizePath(value).trim())
    .filter(value => value.length > 0);
};

const extractPlanStepBlock = (contents: string, stepNumber: number): string | null => {
  const anchor = `<a id="Step-${stepNumber}"></a>`;
  const startIndex = contents.indexOf(anchor);

  if (startIndex === -1) {
    return null;
  }

  const rest = contents.slice(startIndex + anchor.length);
  const nextAnchorIndex = rest.search(/<a\s+id="Step-[0-9]+"><\/a>/);
  const nextSectionIndex = rest.indexOf('\n## ');
  let endIndex = contents.length;

  if (nextAnchorIndex !== -1) {
    endIndex = Math.min(endIndex, startIndex + anchor.length + nextAnchorIndex);
  }

  if (nextSectionIndex !== -1) {
    endIndex = Math.min(endIndex, startIndex + anchor.length + nextSectionIndex);
  }

  return contents.slice(startIndex, endIndex);
};

const extractPlanStepFileMustMap = (contents: string, stepNumber: number): ReadonlyMap<string, readonly string[]> => {
  const block = extractPlanStepBlock(contents, stepNumber);

  if (block === null) {
    return new Map();
  }

  const lines = splitLines(block);
  const map = new Map<string, string[]>();
  let inMapping = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inMapping) {
      if (trimmed.includes('File → MUST IDs') && trimmed.includes('매핑')) {
        inMapping = true;
      }

      continue;
    }

    if (trimmed.startsWith('- Step ↔') || trimmed.startsWith('- Tasks') || trimmed.startsWith('### Step')) {
      break;
    }

    const match = trimmed.match(/^[-*]\s+([^:]+?)\s*:\s*(.+)\s*$/);
    const rawFile = match?.[1];
    const rawIds = match?.[2];

    if (typeof rawFile !== 'string' || rawFile.trim().length === 0) {
      continue;
    }

    if (typeof rawIds !== 'string' || rawIds.trim().length === 0) {
      continue;
    }

    const filePath = normalizePath(rawFile.trim());
    const mustIds = rawIds
      .split(',')
      .map(value => value.trim())
      .filter(value => /^MUST-[0-9]+[a-z]?$/.test(value));

    if (mustIds.length === 0) {
      continue;
    }

    map.set(filePath, [...new Set(mustIds)].sort());
  }

  return map;
};

const hasMustTag = (contents: string, mustId: string): boolean => new RegExp(`\\bMUST:\\s*${mustId}\\b`).test(contents);

const listPlanRequiredSnippets = (): ReadonlyArray<string> => [
  '# Run Plan',
  '## 0) Metadata (필수)',
  '## 1) 원문(사용자 입력) (필수)',
  '## 2) Spec Binding (필수)',
  '## 3) Open Questions (STOP 후보)',
  '## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)',
  '## 6) 범위(Scope) / 비범위(Non-Goals) (필수)',
  '## 9) 실행 계획 (Step Gates, 필수)',
  '## 10) 검증 매트릭스 (MUST → Evidence, 필수)',
];

const validateSnippets = (filePath: string, contents: string, snippets: ReadonlyArray<string>): string[] => {
  const errors: string[] = [];

  for (const snippet of snippets) {
    if (!contents.includes(snippet)) {
      errors.push(`[plan-task-verify] ${filePath}: missing snippet: ${snippet}`);
    }
  }

  return errors;
};

const extractMustIdsFromSnapshot = (contents: string): string[] => {
  const lines = splitLines(contents);
  const ids = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^[-*]\s+(MUST-[0-9]+[a-z]?):\s*$/);
    const candidate = match?.[1];

    if (typeof candidate === 'string' && candidate.length > 0) {
      ids.add(candidate);
    }
  }

  return [...ids].sort();
};

const extractMustIdsFromEvidenceMatrix = (contents: string): string[] => {
  const lines = splitLines(contents);
  const ids = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    if (cells.length < 2) {
      continue;
    }

    const mustId = cells[0] ?? '';

    if (mustId.length > 0 && /^MUST-[0-9]+[a-z]?$/.test(mustId)) {
      ids.add(mustId);
    }
  }

  return [...ids].sort();
};

const validateMustEvidenceOneToOne = (filePath: string, contents: string): string[] => {
  const errors: string[] = [];
  const snapshotMustIds = extractMustIdsFromSnapshot(contents);
  const matrixMustIds = extractMustIdsFromEvidenceMatrix(contents);

  if (snapshotMustIds.length === 0 || matrixMustIds.length === 0) {
    return errors;
  }

  const snapshotSet = new Set(snapshotMustIds);
  const matrixSet = new Set(matrixMustIds);

  for (const mustId of snapshotSet) {
    if (!matrixSet.has(mustId)) {
      errors.push(`[plan-task-verify] ${filePath}: MUST in Snapshot missing in Evidence Matrix: ${mustId}`);
    }
  }

  for (const mustId of matrixSet) {
    if (!snapshotSet.has(mustId)) {
      errors.push(`[plan-task-verify] ${filePath}: MUST in Evidence Matrix missing in Snapshot: ${mustId}`);
    }
  }

  return errors;
};

const isFinalPlanStatus = (status: string): boolean => ['accepted', 'in-progress', 'implemented'].includes(status);

const validatePlan = (filePath: string, contents: string): string[] => {
  const errors: string[] = [];
  const frontmatter = extractFrontmatter(contents);

  if (frontmatter === null) {
    errors.push(`[plan-task-verify] ${filePath}: missing frontmatter (--- ... ---)`);

    return errors;
  }

  const status = extractFrontmatterField(frontmatter, 'status');

  if (status === null) {
    errors.push(`[plan-task-verify] ${filePath}: missing frontmatter field: status`);

    return errors;
  }

  const allowedPaths = extractPlanAllowedPaths(contents);

  if (allowedPaths.length === 0) {
    errors.push(`[plan-task-verify] ${filePath}: missing frontmatter field: allowed_paths (list)`);
  }

  errors.push(...validateSnippets(filePath, contents, listPlanRequiredSnippets()));

  if (isFinalPlanStatus(status)) {
    const placeholders = findPlaceholders(contents);

    for (const placeholder of placeholders) {
      errors.push(`[plan-task-verify] ${filePath}: unresolved placeholder: ${placeholder}`);
    }

    const unchecked = findUnresolvedCheckboxes(contents);

    for (const entry of unchecked) {
      errors.push(`[plan-task-verify] ${filePath}: unresolved checkbox: ${entry}`);
    }

    const stripped = stripFencedCodeBlocks(contents);

    if (!stripped.includes('- none') && !stripped.includes('none |')) {
      errors.push(`[plan-task-verify] ${filePath}: Open Questions must be 'none' for status=${status}`);
    }

    errors.push(...validateMustEvidenceOneToOne(filePath, contents));
  }

  return errors;
};

const extractTaskStatus = (contents: string): string | null => {
  const match = contents.match(/^-\s*Status:\s*`?<([^>]+)>`?\s*$/m);
  const raw = match?.[1];

  if (typeof raw === 'string' && raw.length > 0) {
    const primary = raw.split('|')[0] ?? '';
    const value = primary.trim();

    return value.length > 0 ? value : null;
  }

  const lineMatch = contents.match(/^-\s*Status:\s*`?([^`\n]+)`?\s*$/m);
  const rawLine = lineMatch?.[1];
  const value = typeof rawLine === 'string' ? rawLine.trim() : '';

  return value.length > 0 ? value : null;
};

const isDoneTaskStatus = (status: string): boolean => status === 'done';

const isCodeChangeFile = (filePath: string): boolean => isCodeFile(filePath);

const normalizeList = (values: readonly string[]): string[] =>
  [...new Set(values.map(value => normalizePath(value).trim()).filter(value => value.length > 0))].sort();

const listUnmappedMustIds = (taskMustIds: readonly string[], fileMustMap: ReadonlyMap<string, readonly string[]>): string[] => {
  if (taskMustIds.length === 0) {
    return [];
  }

  const mapped = new Set<string>();

  for (const ids of fileMustMap.values()) {
    for (const mustId of ids) {
      mapped.add(mustId);
    }
  }

  return taskMustIds.filter(mustId => !mapped.has(mustId));
};

const validateTask = async (filePath: string, contents: string): Promise<string[]> => {
  const errors: string[] = [];

  if (!contents.includes('# Task')) {
    errors.push(`[plan-task-verify] ${filePath}: missing heading: # Task`);
  }

  if (!contents.includes('## 1.1) Plan ↔ Task Traceability (Gate, 필수)')) {
    errors.push(`[plan-task-verify] ${filePath}: missing section: Plan ↔ Task Traceability`);
  }

  if (!contents.includes('### Plan Extract (원문 복사, 필수)')) {
    errors.push(`[plan-task-verify] ${filePath}: missing section: Plan Extract`);
  }

  if (!contents.includes('### Plan Code Scope Cross-check (Gate, 필수)')) {
    errors.push(`[plan-task-verify] ${filePath}: missing section: Plan Code Scope Cross-check`);
  }

  const planLink = extractTaskPlanLink(contents);

  if (planLink === null) {
    errors.push(`[plan-task-verify] ${filePath}: missing plan link (required: plans/<...>.md#Step-N)`);
  }

  const allowedPaths = extractTaskAllowedPaths(contents);

  if (allowedPaths.length === 0) {
    errors.push(`[plan-task-verify] ${filePath}: missing Allowed paths (MUST) list`);
  }

  const fileMustMap = extractTaskFileMustMap(contents);

  if (!contents.includes('File → MUST IDs') || !contents.includes('매핑')) {
    errors.push(`[plan-task-verify] ${filePath}: missing section: File → MUST IDs 매핑 (MUST)`);
  }

  if (planLink !== null) {
    const parsed = parsePlanLink(planLink);

    if (parsed === null) {
      errors.push(`[plan-task-verify] ${filePath}: invalid plan link format: ${planLink}`);
    } else {
      const { planPath, stepNumber } = parsed;

      if (!(await Bun.file(planPath).exists())) {
        errors.push(`[plan-task-verify] ${filePath}: referenced plan file not found: ${planPath}`);
      } else {
        const planContents = await Bun.file(planPath).text();
        const planAllowedPaths = extractPlanAllowedPaths(planContents);
        const normalizedTaskAllowedPaths = normalizeList(allowedPaths);
        const normalizedPlanAllowedPaths = normalizeList(planAllowedPaths);

        if (normalizedPlanAllowedPaths.length === 0) {
          errors.push(`[plan-task-verify] ${filePath}: referenced plan missing frontmatter allowed_paths: ${planPath}`);
        } else if (normalizedTaskAllowedPaths.join('\n') !== normalizedPlanAllowedPaths.join('\n')) {
          errors.push(
            `[plan-task-verify] ${filePath}: Allowed paths must match Plan frontmatter allowed_paths exactly (copy from Plan)`,
          );
        }

        const anchor = `<a id="Step-${stepNumber}"></a>`;

        if (!planContents.includes(anchor)) {
          errors.push(
            `[plan-task-verify] ${filePath}: referenced plan is missing required Step anchor: ${planPath}#Step-${stepNumber}`,
          );
        }

        const planStepMap = extractPlanStepFileMustMap(planContents, stepNumber);

        if (planStepMap.size === 0) {
          errors.push(
            `[plan-task-verify] ${filePath}: referenced Plan Step is missing File → MUST IDs mapping: ${planPath}#Step-${stepNumber}`,
          );
        } else {
          for (const [mappedFile, mappedMustIds] of fileMustMap.entries()) {
            const planMustIds = planStepMap.get(mappedFile);

            if (planMustIds === undefined) {
              errors.push(
                `[plan-task-verify] ${filePath}: File → MUST IDs 매핑 contains file not present in Plan Step mapping: ${mappedFile}`,
              );

              continue;
            }

            const normalizedTaskMustIds = normalizeList(mappedMustIds);
            const normalizedPlanMustIds = normalizeList(planMustIds);

            if (normalizedTaskMustIds.join(',') !== normalizedPlanMustIds.join(',')) {
              errors.push(
                `[plan-task-verify] ${filePath}: File → MUST IDs 매핑 must be copied from Plan Step exactly for: ${mappedFile}`,
              );
            }
          }
        }
      }
    }
  }

  const status = extractTaskStatus(contents);

  if (typeof status === 'string' && status.length > 0 && isDoneTaskStatus(status)) {
    const placeholders = findPlaceholders(contents);

    for (const placeholder of placeholders) {
      errors.push(`[plan-task-verify] ${filePath}: unresolved placeholder: ${placeholder}`);
    }

    const unchecked = findUnresolvedCheckboxes(contents);

    for (const entry of unchecked) {
      errors.push(`[plan-task-verify] ${filePath}: unresolved checkbox: ${entry}`);
    }

    const mustIds = extractTaskMustIds(contents);
    const filesToChange = extractTaskFilesToChange(contents);
    const codeFilesToChange = filesToChange.filter(isCodeChangeFile);

    if (codeFilesToChange.length > 0 && fileMustMap.size === 0) {
      errors.push(`[plan-task-verify] ${filePath}: Status=done requires File → MUST IDs 매핑 for changed code files`);
    }

    for (const codeFile of codeFilesToChange) {
      if (!fileMustMap.has(codeFile)) {
        errors.push(`[plan-task-verify] ${filePath}: Status=done requires mapping entry for code file: ${codeFile}`);
      }
    }

    for (const mappedFile of fileMustMap.keys()) {
      if (!filesToChange.includes(mappedFile)) {
        errors.push(
          `[plan-task-verify] ${filePath}: File → MUST IDs 매핑 includes file not listed in Files to change (expected): ${mappedFile}`,
        );
      }
    }

    const unmapped = listUnmappedMustIds(mustIds, fileMustMap);

    for (const mustId of unmapped) {
      errors.push(`[plan-task-verify] ${filePath}: MUST ID is not mapped to any file in File → MUST IDs 매핑: ${mustId}`);
    }

    for (const [mappedFile, mappedMustIds] of fileMustMap.entries()) {
      if (!isCodeFile(mappedFile)) {
        continue;
      }

      if (!(await Bun.file(mappedFile).exists())) {
        errors.push(`[plan-task-verify] ${filePath}: referenced changed file not found: ${mappedFile}`);

        continue;
      }

      const fileContents = await Bun.file(mappedFile).text();

      for (const mustId of mappedMustIds) {
        if (!hasMustTag(fileContents, mustId)) {
          errors.push(
            `[plan-task-verify] ${filePath}: Status=done requires MUST tag (e.g. "// MUST: ${mustId}") in mapped file: ${mappedFile}`,
          );
        }
      }
    }
  }

  return errors;
};

const listTargets = (files: readonly string[]): string[] => {
  const normalized = files.map(normalizePath);

  return normalized.filter(file => isMarkdownFile(file) && (isPlanFile(file) || isTaskFile(file)));
};

const runPlanTaskVerify = async (files: readonly string[]): Promise<boolean> => {
  const targets = listTargets(files);

  if (targets.length === 0) {
    return false;
  }

  const errors: string[] = [];
  const hasCodeChanges = files.some(file => isCodeFile(file));
  const implementedPlans = new Map<string, string[]>();
  const doneTaskMustByPlan = new Map<string, Set<string>>();

  for (const filePath of targets) {
    if (!(await Bun.file(filePath).exists())) {
      errors.push(`[plan-task-verify] ${filePath}: file not found`);

      continue;
    }

    const contents = await Bun.file(filePath).text();

    if (isPlanFile(filePath)) {
      const frontmatter = extractFrontmatter(contents);
      const status = frontmatter === null ? null : extractFrontmatterField(frontmatter, 'status');

      if (status === 'implemented') {
        implementedPlans.set(filePath, extractMustIdsFromSnapshot(contents));
      }

      errors.push(...validatePlan(filePath, contents));

      continue;
    }

    if (isTaskFile(filePath)) {
      errors.push(...(await validateTask(filePath, contents)));

      const status = extractTaskStatus(contents);
      const planLink = extractTaskPlanLink(contents);

      if (status === 'done' && planLink !== null) {
        const parsed = parsePlanLink(planLink);

        if (parsed !== null) {
          const existing = doneTaskMustByPlan.get(parsed.planPath) ?? new Set<string>();
          const mustIds = extractTaskMustIds(contents);

          for (const mustId of mustIds) {
            existing.add(mustId);
          }

          doneTaskMustByPlan.set(parsed.planPath, existing);
        }
      }

      continue;
    }
  }

  if (hasCodeChanges && implementedPlans.size > 0) {
    for (const [planPath, snapshotMustIds] of implementedPlans.entries()) {
      if (snapshotMustIds.length === 0) {
        continue;
      }

      const covered = doneTaskMustByPlan.get(planPath);

      if (covered === undefined || covered.size === 0) {
        errors.push(
          `[plan-task-verify] ${planPath}: status=implemented with code changes requires at least one Status=done task covering MUST IDs`,
        );

        continue;
      }

      for (const mustId of snapshotMustIds) {
        if (!covered.has(mustId)) {
          errors.push(`[plan-task-verify] ${planPath}: status=implemented missing MUST coverage by done tasks: ${mustId}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }

    process.exit(1);
  }

  console.log('[verify] Plan/Task checks passed.');

  return true;
};

export { runPlanTaskVerify };
