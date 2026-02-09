import { eq, inArray } from 'drizzle-orm';

import * as schema from '../../drizzle/schema';
import type { RepoContext, Id } from './_shared';

export type TypeRepo = {
	ensureEntityTypeId: (name: string) => Promise<Id>;
	ensureFactTypeId: (name: string) => Promise<Id>;
	ensureRelationTypeId: (name: string) => Promise<Id>;
	ensureStrengthTypeId: (name: string) => Promise<Id>;
	getEntityTypeIdByName: (name: string) => Promise<Id | null>;
	getFactTypeIdByName: (name: string) => Promise<Id | null>;
	getRelationTypeIdByName: (name: string) => Promise<Id | null>;
	getStrengthTypeIdByName: (name: string) => Promise<Id | null>;
	getEntityTypeNameById: (id: Id) => Promise<string | null>;
	getFactTypeNameById: (id: Id) => Promise<string | null>;
	getRelationTypeNameById: (id: Id) => Promise<string | null>;
	getStrengthTypeNameById: (id: Id) => Promise<string | null>;
	getEntityTypeNamesByIds: (ids: Id[]) => Promise<Map<Id, string>>;
	getFactTypeNamesByIds: (ids: Id[]) => Promise<Map<Id, string>>;
	getRelationTypeNamesByIds: (ids: Id[]) => Promise<Map<Id, string>>;
	getStrengthTypeNamesByIds: (ids: Id[]) => Promise<Map<Id, string>>;
};

export function createTypeRepo(ctx: RepoContext): TypeRepo {
	const cache = new Map<string, Id>();
	const nameCache = {
		entity: new Map<Id, string>(),
		fact: new Map<Id, string>(),
		relation: new Map<Id, string>(),
		strength: new Map<Id, string>(),
	};

	async function ensureTypeId(
		kind: 'entity' | 'fact' | 'relation' | 'strength',
		name: string,
	): Promise<Id> {
		const key = `${kind}:${name}`;
		const cached = cache.get(key);
		if (cached != null) return cached;

		if (kind === 'entity') {
			const insertRows = await ctx.db
				.insert(schema.entityType)
				.values({ name })
				.onConflictDoNothing()
				.returning({ id: schema.entityType.id });
			const inserted = insertRows[0]?.id;
			if (inserted != null) {
				cache.set(key, inserted);
				return inserted;
			}
			const selectRows = await ctx.db
				.select({ id: schema.entityType.id })
				.from(schema.entityType)
				.where(eq(schema.entityType.name, name))
				.limit(1);
			const row = selectRows[0];
			if (!row) throw new Error(`Failed to resolve type id for entity_type:${name}`);
			cache.set(key, row.id);
			return row.id;
		}

		if (kind === 'fact') {
			const insertRows = await ctx.db
				.insert(schema.factType)
				.values({ name })
				.onConflictDoNothing()
				.returning({ id: schema.factType.id });
			const inserted = insertRows[0]?.id;
			if (inserted != null) {
				cache.set(key, inserted);
				return inserted;
			}
			const selectRows = await ctx.db
				.select({ id: schema.factType.id })
				.from(schema.factType)
				.where(eq(schema.factType.name, name))
				.limit(1);
			const row = selectRows[0];
			if (!row) throw new Error(`Failed to resolve type id for fact_type:${name}`);
			cache.set(key, row.id);
			return row.id;
		}

		if (kind === 'relation') {
			const insertRows = await ctx.db
				.insert(schema.relationType)
				.values({ name })
				.onConflictDoNothing()
				.returning({ id: schema.relationType.id });
			const inserted = insertRows[0]?.id;
			if (inserted != null) {
				cache.set(key, inserted);
				return inserted;
			}
			const selectRows = await ctx.db
				.select({ id: schema.relationType.id })
				.from(schema.relationType)
				.where(eq(schema.relationType.name, name))
				.limit(1);
			const row = selectRows[0];
			if (!row) throw new Error(`Failed to resolve type id for relation_type:${name}`);
			cache.set(key, row.id);
			return row.id;
		}

		if (kind === 'strength') {
			const insertRows = await ctx.db
				.insert(schema.strengthType)
				.values({ name })
				.onConflictDoNothing()
				.returning({ id: schema.strengthType.id });
			const inserted = insertRows[0]?.id;
			if (inserted != null) {
				cache.set(key, inserted);
				return inserted;
			}
			const selectRows = await ctx.db
				.select({ id: schema.strengthType.id })
				.from(schema.strengthType)
				.where(eq(schema.strengthType.name, name))
				.limit(1);
			const row = selectRows[0];
			if (!row) throw new Error(`Failed to resolve type id for strength_type:${name}`);
			cache.set(key, row.id);
			return row.id;
		}

		const _exhaustive: never = kind;
		return _exhaustive;
	}

	return {
		ensureEntityTypeId: (name) => ensureTypeId('entity', name),
		ensureFactTypeId: (name) => ensureTypeId('fact', name),
		ensureRelationTypeId: (name) => ensureTypeId('relation', name),
		ensureStrengthTypeId: (name) => ensureTypeId('strength', name),
		getEntityTypeIdByName: async (name) => {
			const key = `entity:${name}`;
			const cached = cache.get(key);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ id: schema.entityType.id })
				.from(schema.entityType)
				.where(eq(schema.entityType.name, name))
				.limit(1);
			const id = rows[0]?.id ?? null;
			if (id != null) cache.set(key, id);
			return id;
		},
		getFactTypeIdByName: async (name) => {
			const key = `fact:${name}`;
			const cached = cache.get(key);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ id: schema.factType.id })
				.from(schema.factType)
				.where(eq(schema.factType.name, name))
				.limit(1);
			const id = rows[0]?.id ?? null;
			if (id != null) cache.set(key, id);
			return id;
		},
		getRelationTypeIdByName: async (name) => {
			const key = `relation:${name}`;
			const cached = cache.get(key);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ id: schema.relationType.id })
				.from(schema.relationType)
				.where(eq(schema.relationType.name, name))
				.limit(1);
			const id = rows[0]?.id ?? null;
			if (id != null) cache.set(key, id);
			return id;
		},
		getStrengthTypeIdByName: async (name) => {
			const key = `strength:${name}`;
			const cached = cache.get(key);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ id: schema.strengthType.id })
				.from(schema.strengthType)
				.where(eq(schema.strengthType.name, name))
				.limit(1);
			const id = rows[0]?.id ?? null;
			if (id != null) cache.set(key, id);
			return id;
		},
		getEntityTypeNameById: async (id) => {
			const cached = nameCache.entity.get(id);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ name: schema.entityType.name })
				.from(schema.entityType)
				.where(eq(schema.entityType.id, id))
				.limit(1);
			const name = rows[0]?.name ?? null;
			if (name) nameCache.entity.set(id, name);
			return name;
		},
		getFactTypeNameById: async (id) => {
			const cached = nameCache.fact.get(id);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ name: schema.factType.name })
				.from(schema.factType)
				.where(eq(schema.factType.id, id))
				.limit(1);
			const name = rows[0]?.name ?? null;
			if (name) nameCache.fact.set(id, name);
			return name;
		},
		getRelationTypeNameById: async (id) => {
			const cached = nameCache.relation.get(id);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ name: schema.relationType.name })
				.from(schema.relationType)
				.where(eq(schema.relationType.id, id))
				.limit(1);
			const name = rows[0]?.name ?? null;
			if (name) nameCache.relation.set(id, name);
			return name;
		},
		getStrengthTypeNameById: async (id) => {
			const cached = nameCache.strength.get(id);
			if (cached != null) return cached;
			const rows = await ctx.db
				.select({ name: schema.strengthType.name })
				.from(schema.strengthType)
				.where(eq(schema.strengthType.id, id))
				.limit(1);
			const name = rows[0]?.name ?? null;
			if (name) nameCache.strength.set(id, name);
			return name;
		},
		getEntityTypeNamesByIds: async (ids) => {
			const out = new Map<Id, string>();
			const missing = ids.filter((id) => !nameCache.entity.has(id));
			for (const id of ids) {
				const v = nameCache.entity.get(id);
				if (v != null) out.set(id, v);
			}
			if (missing.length > 0) {
				const rows = await ctx.db
					.select({ id: schema.entityType.id, name: schema.entityType.name })
					.from(schema.entityType)
					.where(inArray(schema.entityType.id, missing));
				for (const r of rows) {
					nameCache.entity.set(r.id, r.name);
					out.set(r.id, r.name);
				}
			}
			return out;
		},
		getFactTypeNamesByIds: async (ids) => {
			const out = new Map<Id, string>();
			const missing = ids.filter((id) => !nameCache.fact.has(id));
			for (const id of ids) {
				const v = nameCache.fact.get(id);
				if (v != null) out.set(id, v);
			}
			if (missing.length > 0) {
				const rows = await ctx.db
					.select({ id: schema.factType.id, name: schema.factType.name })
					.from(schema.factType)
					.where(inArray(schema.factType.id, missing));
				for (const r of rows) {
					nameCache.fact.set(r.id, r.name);
					out.set(r.id, r.name);
				}
			}
			return out;
		},
		getRelationTypeNamesByIds: async (ids) => {
			const out = new Map<Id, string>();
			const missing = ids.filter((id) => !nameCache.relation.has(id));
			for (const id of ids) {
				const v = nameCache.relation.get(id);
				if (v != null) out.set(id, v);
			}
			if (missing.length > 0) {
				const rows = await ctx.db
					.select({ id: schema.relationType.id, name: schema.relationType.name })
					.from(schema.relationType)
					.where(inArray(schema.relationType.id, missing));
				for (const r of rows) {
					nameCache.relation.set(r.id, r.name);
					out.set(r.id, r.name);
				}
			}
			return out;
		},
		getStrengthTypeNamesByIds: async (ids) => {
			const out = new Map<Id, string>();
			const missing = ids.filter((id) => !nameCache.strength.has(id));
			for (const id of ids) {
				const v = nameCache.strength.get(id);
				if (v != null) out.set(id, v);
			}
			if (missing.length > 0) {
				const rows = await ctx.db
					.select({ id: schema.strengthType.id, name: schema.strengthType.name })
					.from(schema.strengthType)
					.where(inArray(schema.strengthType.id, missing));
				for (const r of rows) {
					nameCache.strength.set(r.id, r.name);
					out.set(r.id, r.name);
				}
			}
			return out;
		},
	};
}
