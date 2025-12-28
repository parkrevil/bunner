import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Violation = {
  readonly rule: string;
  readonly file: string;
  readonly message: string;
};

type WorkspaceRoot = {
  readonly kind: 'packages' | 'examples';
  readonly rootRelPath: string;
};

type ImportSpecifier = {
  readonly specifier: string;
  readonly isTypeOnly: boolean;
};

type Graph = ReadonlyMap<string, ReadonlySet<string>>;

type WorkspacePackage = {
  readonly name: string;
  readonly dirName: string;
  readonly packageJsonRelPath: string;
  readonly entrypointRelPath: string | null;
  readonly dependencyNames: readonly string[];
};

function getProjectRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);

  return path.resolve(path.dirname(thisFile), '..');
}

function isScannableSourceFile(relPath: string): boolean {
  if (relPath.includes('/node_modules/')) {
    return false;
  }

  if (relPath.startsWith('node_modules/')) {
    return false;
  }

  if (relPath.includes('/dist/')) {
    return false;
  }

  if (relPath.startsWith('dist/')) {
    return false;
  }

  if (relPath.includes('/.bunner/')) {
    return false;
  }

  if (relPath.startsWith('.bunner/')) {
    return false;
  }

  if (relPath.endsWith('.d.ts')) {
    return false;
  }

  return relPath.endsWith('.ts') || relPath.endsWith('.tsx') || relPath.endsWith('.js') || relPath.endsWith('.jsx');
}

function detectWorkspaceRoot(relPath: string): WorkspaceRoot | null {
  const parts = relPath.split('/').filter(p => p.length > 0);

  if (parts.length === 0) {
    return null;
  }

  if (parts[0] === 'examples') {
    return { kind: 'examples', rootRelPath: 'examples' };
  }

  if (parts[0] === 'packages' && parts.length >= 2) {
    return { kind: 'packages', rootRelPath: `packages/${parts[1]}` };
  }

  return null;
}

function extractSpecifiers(sourceText: string): readonly string[] {
  const specifiers: string[] = [];
  const fromRe = /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g;
  const sideEffectImportRe = /\bimport\s+(?:type\s+)?['"]([^'"]+)['"]/g;
  const requireRe = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicImportRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [fromRe, sideEffectImportRe, requireRe, dynamicImportRe]) {
    let match: RegExpExecArray | null;

    while ((match = re.exec(sourceText)) !== null) {
      const specifier = match[1];

      if (typeof specifier !== 'string' || specifier.length === 0) {
        continue;
      }

      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function extractImportSpecifiers(sourceText: string): readonly ImportSpecifier[] {
  const specifiers: ImportSpecifier[] = [];
  const fromRe = /\b(import|export)\s+(type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g;
  const sideEffectImportRe = /\bimport\s+(type\s+)?['"]([^'"]+)['"]/g;
  const requireRe = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicImportRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = fromRe.exec(sourceText)) !== null) {
    const keyword = match[1];
    const typePart = match[2];
    const specifier = match[3];

    void keyword;

    if (typeof specifier === 'string' && specifier.length > 0) {
      specifiers.push({
        specifier,
        isTypeOnly: typeof typePart === 'string' && typePart.length > 0,
      });
    }
  }

  while ((match = sideEffectImportRe.exec(sourceText)) !== null) {
    const typePart = match[1];
    const specifier = match[2];

    if (typeof specifier === 'string' && specifier.length > 0) {
      specifiers.push({ specifier, isTypeOnly: typeof typePart === 'string' && typePart.length > 0 });
    }
  }

  while ((match = requireRe.exec(sourceText)) !== null) {
    const specifier = match[1];

    if (typeof specifier === 'string' && specifier.length > 0) {
      specifiers.push({ specifier, isTypeOnly: false });
    }
  }

  while ((match = dynamicImportRe.exec(sourceText)) !== null) {
    const specifier = match[1];

    if (typeof specifier === 'string' && specifier.length > 0) {
      specifiers.push({ specifier, isTypeOnly: false });
    }
  }

  return specifiers;
}

function isBuiltinOrExternalRuntimeSpecifier(specifier: string): boolean {
  if (specifier.startsWith('node:')) {
    return true;
  }

  if (specifier.startsWith('bun:')) {
    return true;
  }

  if (specifier.startsWith('http:') || specifier.startsWith('https:')) {
    return true;
  }

  return false;
}

function isBunnerDeepImport(specifier: string): boolean {
  if (specifier.startsWith('packages/')) {
    return true;
  }

  const bunnerPkgMatch = /^@bunner\/[^/]+\//.exec(specifier);

  return bunnerPkgMatch !== null;
}

function resolveRelativeImport(params: {
  readonly projectRoot: string;
  readonly importerAbsPath: string;
  readonly specifier: string;
}): string | null {
  const { projectRoot, importerAbsPath, specifier } = params;

  if (!specifier.startsWith('.')) {
    return null;
  }

  const importerDir = path.dirname(importerAbsPath);
  const rawTarget = path.resolve(importerDir, specifier);
  const candidates = [
    rawTarget,
    `${rawTarget}.ts`,
    `${rawTarget}.tsx`,
    `${rawTarget}.js`,
    `${rawTarget}.jsx`,
    path.join(rawTarget, 'index.ts'),
    path.join(rawTarget, 'index.tsx'),
    path.join(rawTarget, 'index.js'),
    path.join(rawTarget, 'index.jsx'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const normalized = path.normalize(candidate);
      const projectRootNormalized = path.normalize(projectRoot + path.sep);

      if (!normalized.startsWith(projectRootNormalized)) {
        return null;
      }

      return normalized;
    }
  }

  return null;
}

function readJsonFile(absPath: string): unknown {
  const text = readFileSync(absPath, 'utf8');

  return JSON.parse(text) as unknown;
}

function getPackageName(pkgJson: unknown): string | null {
  if (pkgJson === null || typeof pkgJson !== 'object') {
    return null;
  }

  const obj = pkgJson as Record<string, unknown>;
  const name = obj['name'];

  if (typeof name !== 'string' || name.length === 0) {
    return null;
  }

  return name;
}

function getDependencyKeys(pkgJson: unknown): readonly string[] {
  if (pkgJson === null || typeof pkgJson !== 'object') {
    return [];
  }

  const obj = pkgJson as Record<string, unknown>;
  const blocks = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
  const keys: string[] = [];

  for (const block of blocks) {
    const blockValue = obj[block];

    if (blockValue === null || typeof blockValue !== 'object') {
      continue;
    }

    for (const key of Object.keys(blockValue as Record<string, unknown>)) {
      keys.push(key);
    }
  }

  return keys;
}

function getRuntimeDependencyKeys(pkgJson: unknown): readonly string[] {
  if (pkgJson === null || typeof pkgJson !== 'object') {
    return [];
  }

  const obj = pkgJson as Record<string, unknown>;
  const blocks = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;
  const keys: string[] = [];

  for (const block of blocks) {
    const blockValue = obj[block];

    if (blockValue === null || typeof blockValue !== 'object') {
      continue;
    }

    for (const key of Object.keys(blockValue as Record<string, unknown>)) {
      keys.push(key);
    }
  }

  return keys;
}

function getPackageEntrypointRelPath(params: { readonly projectRoot: string; readonly packageDirName: string }): string | null {
  const { projectRoot, packageDirName } = params;
  const rel = `packages/${packageDirName}/index.ts`;
  const abs = path.join(projectRoot, rel);

  if (!existsSync(abs)) {
    return null;
  }

  return rel;
}

async function loadWorkspacePackages(projectRoot: string): Promise<readonly WorkspacePackage[]> {
  const glob = new Bun.Glob('packages/*/package.json');
  const packages: WorkspacePackage[] = [];

  for await (const relPath of glob.scan(projectRoot)) {
    const normalized = String(relPath).replaceAll('\\', '/');
    const dirName = normalized.split('/')[1];

    if (typeof dirName !== 'string' || dirName.length === 0) {
      continue;
    }

    const packageJsonAbsPath = path.join(projectRoot, normalized);
    const pkgJson = readJsonFile(packageJsonAbsPath);
    const name = getPackageName(pkgJson);

    if (name === null) {
      continue;
    }

    const entrypointRelPath = getPackageEntrypointRelPath({ projectRoot, packageDirName: dirName });
    const dependencyNames = getRuntimeDependencyKeys(pkgJson);

    packages.push({
      name,
      dirName,
      packageJsonRelPath: normalized,
      entrypointRelPath,
      dependencyNames,
    });
  }

  const examplesPackageJsonRelPath = 'examples/package.json';
  const examplesPackageJsonAbs = path.join(projectRoot, examplesPackageJsonRelPath);

  if (existsSync(examplesPackageJsonAbs)) {
    const pkgJson = readJsonFile(examplesPackageJsonAbs);
    const name = getPackageName(pkgJson);

    if (name !== null) {
      packages.push({
        name,
        dirName: 'examples',
        packageJsonRelPath: examplesPackageJsonRelPath,
        entrypointRelPath: null,
        dependencyNames: getRuntimeDependencyKeys(pkgJson),
      });
    }
  }

  packages.sort((a, b) => a.name.localeCompare(b.name));

  return packages;
}

function buildGraph(edges: ReadonlyArray<readonly [string, string]>): Graph {
  const map = new Map<string, Set<string>>();

  for (const [from, to] of edges) {
    const set = map.get(from) ?? new Set<string>();

    set.add(to);
    map.set(from, set);

    if (!map.has(to)) {
      map.set(to, new Set<string>());
    }
  }

  return map;
}

function findStronglyConnectedComponents(graph: Graph): readonly (readonly string[])[] {
  const indexByNode = new Map<string, number>();
  const lowlinkByNode = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let index = 0;
  const sccs: string[][] = [];
  const nodes = [...graph.keys()].sort((a, b) => a.localeCompare(b));
  const strongConnect = (node: string): void => {
    indexByNode.set(node, index);
    lowlinkByNode.set(node, index);

    index += 1;

    stack.push(node);
    onStack.add(node);

    const neighbors = [...(graph.get(node) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));

    for (const neighbor of neighbors) {
      if (!indexByNode.has(neighbor)) {
        strongConnect(neighbor);

        const nodeLow = lowlinkByNode.get(node) ?? 0;
        const neighLow = lowlinkByNode.get(neighbor) ?? 0;

        lowlinkByNode.set(node, Math.min(nodeLow, neighLow));

        continue;
      }

      if (onStack.has(neighbor)) {
        const nodeLow = lowlinkByNode.get(node) ?? 0;
        const neighIndex = indexByNode.get(neighbor) ?? 0;

        lowlinkByNode.set(node, Math.min(nodeLow, neighIndex));
      }
    }

    if ((lowlinkByNode.get(node) ?? 0) !== (indexByNode.get(node) ?? 0)) {
      return;
    }

    const component: string[] = [];

    while (true) {
      const w = stack.pop();

      if (w === undefined) {
        break;
      }

      onStack.delete(w);
      component.push(w);

      if (w === node) {
        break;
      }
    }

    component.sort((a, b) => a.localeCompare(b));
    sccs.push(component);
  };

  for (const node of nodes) {
    if (!indexByNode.has(node)) {
      strongConnect(node);
    }
  }

  sccs.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));

  return sccs;
}

function hasSelfLoop(graph: Graph, node: string): boolean {
  return (graph.get(node) ?? new Set<string>()).has(node);
}

function checkRuntimePackagesDoNotDependOnCli(projectRoot: string): readonly Violation[] {
  const runtimePackageDirs = ['common', 'logger', 'core', 'http-adapter', 'scalar'];
  const violations: Violation[] = [];

  for (const dirName of runtimePackageDirs) {
    const pkgJsonPath = path.join(projectRoot, 'packages', dirName, 'package.json');

    if (!existsSync(pkgJsonPath)) {
      continue;
    }

    const pkgJson = readJsonFile(pkgJsonPath);
    const depKeys = getDependencyKeys(pkgJson);

    if (depKeys.includes('@bunner/cli')) {
      violations.push({
        rule: 'runtime-package-must-not-depend-on-cli',
        file: path.relative(projectRoot, pkgJsonPath),
        message: 'Runtime packages MUST NOT depend on @bunner/cli (ARCHITECTURE: dependency direction).',
      });
    }
  }

  return violations;
}

async function checkPackageCycles(projectRoot: string): Promise<readonly Violation[]> {
  const pkgs = await loadWorkspacePackages(projectRoot);
  const workspaceNames = new Set(pkgs.map(p => p.name));
  const edges: Array<readonly [string, string]> = [];

  for (const pkg of pkgs) {
    for (const depName of pkg.dependencyNames) {
      if (!workspaceNames.has(depName)) {
        continue;
      }

      edges.push([pkg.name, depName]);
    }
  }

  const graph = buildGraph(edges);
  const sccs = findStronglyConnectedComponents(graph);
  const violations: Violation[] = [];

  for (const component of sccs) {
    if (component.length > 1) {
      violations.push({
        rule: 'package-cycle',
        file: 'package.json',
        message: `Package dependency cycle detected (ARCHITECTURE: Violation Level 1). component=${JSON.stringify(component)}`,
      });

      continue;
    }

    const [single] = component;

    if (typeof single === 'string' && hasSelfLoop(graph, single)) {
      violations.push({
        rule: 'package-cycle',
        file: 'package.json',
        message: `Package self-cycle detected (ARCHITECTURE: Violation Level 1). package=${JSON.stringify(single)}`,
      });
    }
  }

  return violations;
}

function buildFileGraph(params: {
  readonly projectRoot: string;
  readonly relPaths: readonly string[];
  readonly workspacePkgEntrypointsByName: ReadonlyMap<string, string>;
}): Graph {
  const { projectRoot, relPaths, workspacePkgEntrypointsByName } = params;
  const edges: Array<readonly [string, string]> = [];

  for (const relPath of relPaths) {
    const absPath = path.join(projectRoot, relPath);
    const sourceText = readFileSync(absPath, 'utf8');
    const specifiers = extractImportSpecifiers(sourceText);

    for (const { specifier, isTypeOnly } of specifiers) {
      if (isTypeOnly) {
        continue;
      }

      if (specifier.length === 0) {
        continue;
      }

      if (isBuiltinOrExternalRuntimeSpecifier(specifier)) {
        continue;
      }

      if (specifier.startsWith('.')) {
        const resolvedAbs = resolveRelativeImport({
          projectRoot,
          importerAbsPath: absPath,
          specifier,
        });

        if (resolvedAbs === null) {
          continue;
        }

        const resolvedRel = path.relative(projectRoot, resolvedAbs).replaceAll('\\', '/');

        if (!isScannableSourceFile(resolvedRel)) {
          continue;
        }

        edges.push([relPath, resolvedRel]);

        continue;
      }

      const entry = workspacePkgEntrypointsByName.get(specifier);

      if (typeof entry === 'string') {
        edges.push([relPath, entry]);
      }
    }
  }

  return buildGraph(edges);
}

function checkFileCycles(params: {
  readonly projectRoot: string;
  readonly relPaths: readonly string[];
  readonly workspacePkgEntrypointsByName: ReadonlyMap<string, string>;
}): readonly Violation[] {
  const { projectRoot, relPaths, workspacePkgEntrypointsByName } = params;
  const graph = buildFileGraph({
    projectRoot,
    relPaths,
    workspacePkgEntrypointsByName,
  });
  const sccs = findStronglyConnectedComponents(graph);
  const violations: Violation[] = [];

  void projectRoot;

  for (const component of sccs) {
    if (component.length === 0) {
      continue;
    }

    if (component.length > 1) {
      const first = component[0];

      if (typeof first !== 'string') {
        continue;
      }

      violations.push({
        rule: 'file-cycle',
        file: first,
        message: `File/module cycle detected (ARCHITECTURE: Violation Level 1). component=${JSON.stringify(component)}`,
      });

      continue;
    }

    const [single] = component;

    if (typeof single === 'string' && hasSelfLoop(graph, single)) {
      violations.push({
        rule: 'file-cycle',
        file: single,
        message: `File/module self-cycle detected (ARCHITECTURE: Violation Level 1). file=${JSON.stringify(single)}`,
      });
    }
  }

  return violations;
}

function checkSourceImports(params: {
  readonly projectRoot: string;
  readonly relPaths: readonly string[];
}): readonly Violation[] {
  const { projectRoot, relPaths } = params;
  const violations: Violation[] = [];

  for (const relPath of relPaths) {
    const absPath = path.join(projectRoot, relPath);
    const workspaceRoot = detectWorkspaceRoot(relPath);
    const sourceText = readFileSync(absPath, 'utf8');
    const specifiers = extractSpecifiers(sourceText);

    for (const specifier of specifiers) {
      if (specifier.length === 0) {
        continue;
      }

      if (isBuiltinOrExternalRuntimeSpecifier(specifier)) {
        continue;
      }

      if (isBunnerDeepImport(specifier)) {
        violations.push({
          rule: 'no-cross-package-deep-import',
          file: relPath,
          message: `Deep import is forbidden (ARCHITECTURE: Deep Import). specifier=${JSON.stringify(specifier)}`,
        });

        continue;
      }

      if (workspaceRoot?.kind === 'packages' && specifier.startsWith('examples/')) {
        violations.push({
          rule: 'packages-must-not-import-examples',
          file: relPath,
          message: `Packages MUST NOT reference examples (ARCHITECTURE: Examples). specifier=${JSON.stringify(specifier)}`,
        });

        continue;
      }

      if (workspaceRoot?.kind === 'packages' && specifier.startsWith('.')) {
        const resolvedAbs = resolveRelativeImport({
          projectRoot,
          importerAbsPath: absPath,
          specifier,
        });

        if (resolvedAbs === null) {
          continue;
        }

        const resolvedRel = path.relative(projectRoot, resolvedAbs);

        if (resolvedRel.startsWith('examples/')) {
          violations.push({
            rule: 'packages-must-not-import-examples',
            file: relPath,
            message: `Packages MUST NOT reference examples (ARCHITECTURE: Examples). target=${JSON.stringify(resolvedRel)}`,
          });

          continue;
        }

        const pkgRootRel = workspaceRoot.rootRelPath + '/';

        if (!resolvedRel.startsWith(pkgRootRel)) {
          violations.push({
            rule: 'no-relative-import-escape-package',
            file: relPath,
            message: `Relative imports MUST NOT escape package root (ARCHITECTURE: Monorepo Integrity). target=${JSON.stringify(resolvedRel)}`,
          });
        }
      }
    }
  }

  return violations;
}

function sortViolations(violations: readonly Violation[]): readonly Violation[] {
  return [...violations].sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);

    if (fileCmp !== 0) {
      return fileCmp;
    }

    const ruleCmp = a.rule.localeCompare(b.rule);

    if (ruleCmp !== 0) {
      return ruleCmp;
    }

    return a.message.localeCompare(b.message);
  });
}

async function main(): Promise<void> {
  const projectRoot = getProjectRoot();
  const glob = new Bun.Glob('**/*');
  const relPaths: string[] = [];

  for await (const relPath of glob.scan(projectRoot)) {
    const normalized = String(relPath).replaceAll('\\', '/');

    if (!isScannableSourceFile(normalized)) {
      continue;
    }

    relPaths.push(normalized);
  }

  relPaths.sort((a, b) => a.localeCompare(b));

  const workspacePkgs = await loadWorkspacePackages(projectRoot);
  const workspacePkgEntrypointsByName = new Map<string, string>();

  for (const pkg of workspacePkgs) {
    if (pkg.entrypointRelPath === null) {
      continue;
    }

    workspacePkgEntrypointsByName.set(pkg.name, pkg.entrypointRelPath);
  }

  const violations: Violation[] = [];

  violations.push(...checkRuntimePackagesDoNotDependOnCli(projectRoot));
  violations.push(...(await checkPackageCycles(projectRoot)));
  violations.push(
    ...checkSourceImports({
      projectRoot,
      relPaths,
    }),
  );
  violations.push(
    ...checkFileCycles({
      projectRoot,
      relPaths,
      workspacePkgEntrypointsByName,
    }),
  );

  const sorted = sortViolations(violations);

  if (sorted.length === 0) {
    console.log('architecture-check: OK');

    return;
  }

  console.error(`architecture-check: FAILED (${sorted.length} violation(s))`);

  for (const v of sorted) {
    console.error(`- [${v.rule}] ${v.file}: ${v.message}`);
  }

  process.exitCode = 1;
}

await main();
