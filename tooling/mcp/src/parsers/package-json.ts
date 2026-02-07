/**
 * PackageJsonParser — §4.3 PackageJsonParser (priority 100)
 *
 * 대상: all package.json files
 * 추출: pkg entity, dependency relations
 *
 * @see MCP_PLAN 4.3, 4.5a
 */

import type { Parser, ExtractContext, ExtractionResult } from './types';
import { basename } from 'node:path';

export class PackageJsonParser implements Parser {
	name = 'package-json';
	priority = 100;

	canHandle(filePath: string): boolean {
		return basename(filePath) === 'package.json';
	}

	extract(_filePath: string, content: string, ctx: ExtractContext): ExtractionResult {
		const result: ExtractionResult = {
			entities: [],
			facts: [],
			relations: [],
			sources: [],
		};

		let pkg: Record<string, unknown>;
		try {
			pkg = JSON.parse(content) as Record<string, unknown>;
		} catch {
			return result; // 파싱 실패 → empty
		}

		const name = pkg.name as string | undefined;
		if (!name) return result;

		const entityKey = `pkg:${name}`;
		const version = (pkg.version as string) ?? '';
		const description = (pkg.description as string) ?? '';

		// Entity
		result.entities.push({
			entityKey,
			entityType: 'package',
			summary: description || `Package ${name}@${version}`,
			meta: {
				version,
				...(pkg.main ? { main: pkg.main } : {}),
				...(pkg.types ? { types: pkg.types } : {}),
				...(pkg.exports ? { exports: pkg.exports } : {}),
			},
		});

		// Source
		result.sources.push({
			entityKey,
			kind: 'config',
			filePath: ctx.filePath,
		});

		// Facts
		result.facts.push({
			entityKey,
			factType: 'summary',
			factKey: 'summary:package',
			payloadText: `${name}@${version}: ${description}`,
			payloadJson: { name, version, description },
		});

		// dependencies → dependency facts + depends_on relations
		const depGroups: [string, string][] = [
			['dependencies', 'dependency'],
			['devDependencies', 'dependency'],
			['peerDependencies', 'dependency'],
		];

		for (const [field, factType] of depGroups) {
			const deps = pkg[field] as Record<string, string> | undefined;
			if (!deps) continue;

			for (const [depName, depVersion] of Object.entries(deps)) {
				result.facts.push({
					entityKey,
					factType,
					factKey: `dependency:${depName}`,
					payloadText: `${depName}@${depVersion} (${field})`,
					payloadJson: { name: depName, version: depVersion, group: field },
				});

				// 프로젝트 내부 패키지 의존일 경우 relation 생성
				const dstKey = `pkg:${depName}`;
				const dstEntity = ctx.existingEntities.get(dstKey);
				if (dstEntity) {
					result.relations.push({
						srcEntityKey: entityKey,
						dstEntityKey: dstKey,
						relationType: 'depends_on',
						strength: field === 'peerDependencies' ? 'contract' : 'implementation',
						meta: { group: field, version: depVersion },
					});
				}
			}
		}

		// exports field → export facts
		if (pkg.exports && typeof pkg.exports === 'object') {
			const exports = pkg.exports as Record<string, unknown>;
			for (const [exportPath, exportTarget] of Object.entries(exports)) {
				result.facts.push({
					entityKey,
					factType: 'signature',
					factKey: `export:${exportPath}`,
					payloadText: `export "${exportPath}" → ${typeof exportTarget === 'string' ? exportTarget : JSON.stringify(exportTarget)}`,
					payloadJson: { path: exportPath, target: exportTarget },
				});
			}
		}

		return result;
	}
}
