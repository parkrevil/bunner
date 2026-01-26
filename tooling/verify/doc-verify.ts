import type { DocTemplateRule } from './types';

const DOC_TEMPLATE_RULES: ReadonlyArray<DocTemplateRule> = [
  {
    path: '.agent/plan-template.md',
    label: 'plan-template',
    requiredSnippets: [
      '# Run Plan',
      '## 0) Metadata (필수)',
      '## 1) 원문(사용자 입력) (필수)',
      '## 2) Spec Binding (필수)',
      '## 3) Open Questions (STOP 후보)',
      '## 4) SPEC MUST SNAPSHOT (필수, 원문 복사)',
      '## 5) 목적 / 기대효과 (필수)',
      '## 6) 범위(Scope) / 비범위(Non-Goals) (필수)',
      '## 7) 제약 / 운영 노트 (Gate, 필수)',
    ],
  },
  {
    path: '.agent/task-template.md',
    label: 'task-template',
    requiredSnippets: [
      '# Task',
      '## 1.1) Plan ↔ Task Traceability (Gate, 필수)',
      '### Plan Extract (원문 복사, 필수)',
      '### Plan Code Scope Cross-check (참고, Non-gate)',
      '## 9) Completion Criteria (필수)',
    ],
  },
  {
    path: 'docs/30_SPEC/TEMPLATE.md',
    label: 'spec-template',
    requiredSnippets: [
      '# SPEC 템플릿',
      '## 0. 정체성(Identity) (REQUIRED)',
      '## 1. 범위 잠금(Scope Lock) (REQUIRED)',
      '## 3. 정적 계약(Static Contract) (REQUIRED)',
      '## 10. 토큰 세트(Token Sets) (REQUIRED)',
    ],
  },
];

const normalizePath = (value: string): string => value.replaceAll('\\', '/');

const listDocTemplateChanges = (files: readonly string[]): DocTemplateRule[] => {
  const changed = new Set(files.map(normalizePath));

  return DOC_TEMPLATE_RULES.filter(rule => changed.has(rule.path));
};

const validateTemplate = (rule: DocTemplateRule, contents: string): string[] => {
  const errors: string[] = [];

  for (const snippet of rule.requiredSnippets) {
    if (!contents.includes(snippet)) {
      errors.push(`[doc-verify] ${rule.path}: missing snippet: ${snippet}`);
    }
  }

  return errors;
};

const runDocVerify = async (files: readonly string[]): Promise<boolean> => {
  const targets = listDocTemplateChanges(files);

  if (targets.length === 0) {
    return false;
  }

  const errors: string[] = [];

  for (const rule of targets) {
    const file = Bun.file(rule.path);
    const exists = await file.exists();

    if (!exists) {
      errors.push(`[doc-verify] ${rule.path}: file not found`);

      continue;
    }

    const contents = await file.text();
    const ruleErrors = validateTemplate(rule, contents);

    errors.push(...ruleErrors);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }

    process.exit(1);
  }

  console.log('[verify] Doc template checks passed.');

  return true;
};

export { runDocVerify };
