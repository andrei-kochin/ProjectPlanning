import { describe, expect, it, vi } from 'vitest';
import { LEGACY_TOKEN_KEY, PatAuthProvider } from '../src/lib/auth';
import { addMissingIssues, fetchBoard, nextCursor } from '../src/lib/fetcher';
import { createGraphQLClient, type GraphQLFn } from '../src/lib/graphql';
import { PartialSaveError, saveItemPatch } from '../src/lib/mutations';
import { normalizeBoard } from '../src/lib/normalize';
import { rawIssueItem, testBoard, testConfig } from './helpers';

describe('fetchBoard', () => {
  it('follows item pagination and uses the configured owner type', async () => {
    const pages = [
      { items: [rawIssueItem({ number: 1 })], hasNextPage: true, endCursor: 'c1' },
      { items: [rawIssueItem({ number: 2 })], hasNextPage: false, endCursor: null },
    ];
    const calls: { query: string; vars: any }[] = [];
    const gql: GraphQLFn = async (query, vars) => {
      calls.push({ query, vars });
      const p = pages[calls.length - 1];
      const { items: _ignored, ...board } = testBoard([]);
      return { owner: { projectV2: { ...board, items: { nodes: p.items, pageInfo: { hasNextPage: p.hasNextPage, endCursor: p.endCursor } } } } } as any;
    };
    const board = await fetchBoard(gql, { ...testConfig, board: { owner: 'acme', ownerType: 'organization', number: 4 } });
    expect(board.items.nodes).toHaveLength(2);
    expect(calls.map((c) => c.vars)).toEqual([
      { owner: 'acme', number: 4, after: null },
      { owner: 'acme', number: 4, after: 'c1' },
    ]);
    expect(calls[0].query).toContain('owner: organization(login: $owner)');
  });

  it('fails loudly instead of truncating when a cursor repeats', async () => {
    const { items: _ignored, ...board } = testBoard([]);
    const gql: GraphQLFn = async () =>
      ({ owner: { projectV2: { ...board, items: { nodes: [rawIssueItem({})], pageInfo: { hasNextPage: true, endCursor: 'same' } } } } }) as any;
    await expect(fetchBoard(gql, testConfig)).rejects.toThrow(/repeated cursor/);
  });

  it('explains a missing board', async () => {
    const gql: GraphQLFn = async () => ({ owner: { projectV2: null } }) as any;
    await expect(fetchBoard(gql, testConfig)).rejects.toThrow(/not found or not accessible/);
  });
});

describe('nextCursor', () => {
  it('returns null at the end, the cursor otherwise, and throws on bad page info', () => {
    const seen = new Set<string>();
    expect(nextCursor({ hasNextPage: false, endCursor: 'x' }, seen, 't')).toBeNull();
    expect(nextCursor({ hasNextPage: true, endCursor: 'a' }, seen, 't')).toBe('a');
    expect(() => nextCursor({ hasNextPage: true, endCursor: 'a' }, seen, 't')).toThrow(/repeated/);
    expect(() => nextCursor({ hasNextPage: true, endCursor: null }, seen, 't')).toThrow(/no cursor/);
  });
});

describe('addMissingIssues', () => {
  it('adds only open issues that are not on the board', async () => {
    const board = testBoard([rawIssueItem({ number: 1 })]);
    const added: string[] = [];
    const gql: GraphQLFn = async (query, vars: any) => {
      if (query.includes('addProjectV2ItemById')) {
        added.push(vars.contentId);
        return { addProjectV2ItemById: { item: { id: 'x' } } } as any;
      }
      return {
        repository: { issues: { nodes: [{ id: 'issue-1', number: 1 }, { id: 'issue-2', number: 2 }], pageInfo: { hasNextPage: false } } },
      } as any;
    };
    expect(await addMissingIssues(gql, testConfig, board)).toBe(1);
    expect(added).toEqual(['issue-2']);
  });
});

describe('addMissingIssues with overlapping repos', () => {
  it('never adds the same issue twice', async () => {
    const board = testBoard([]);
    const added: string[] = [];
    const gql: GraphQLFn = async (query, vars: any) => {
      if (query.includes('addProjectV2ItemById')) {
        added.push(vars.contentId);
        return {} as any;
      }
      return { repository: { issues: { nodes: [{ id: 'issue-7', number: 7 }], pageInfo: { hasNextPage: false, endCursor: null } } } } as any;
    };
    expect(await addMissingIssues(gql, { ...testConfig, repos: ['o/r', 'o/r'] }, board)).toBe(1);
    expect(added).toEqual(['issue-7']);
  });
});

describe('saveItemPatch', () => {
  const data = normalizeBoard(testBoard([rawIssueItem({})]), testConfig);

  it('sends one mutation per changed field with the right value shape', async () => {
    const gql = vi.fn(async () => ({}) as any);
    await saveItemPatch(gql, data, 'item-1', { statusOptionId: 'done', dueDate: '2026-10-01', iterationId: 'i2' });
    expect(gql.mock.calls.map((c: any[]) => c[1])).toEqual([
      { projectId: 'PVT_1', itemId: 'item-1', fieldId: 'F_status', value: { singleSelectOptionId: 'done' } },
      { projectId: 'PVT_1', itemId: 'item-1', fieldId: 'F_due', value: { date: '2026-10-01' } },
      { projectId: 'PVT_1', itemId: 'item-1', fieldId: 'F_iter', value: { iterationId: 'i2' } },
    ]);
  });

  it('clears fields set to null', async () => {
    const gql = vi.fn(async () => ({}) as any);
    await saveItemPatch(gql, data, 'item-1', { dueDate: null });
    const [[query, vars]] = gql.mock.calls as any[];
    expect(query).toContain('clearProjectV2ItemFieldValue');
    expect(vars).toEqual({ projectId: 'PVT_1', itemId: 'item-1', fieldId: 'F_due' });
  });

  it('reports which fields were already written when a later mutation fails', async () => {
    let n = 0;
    const gql = vi.fn(async () => {
      if (++n === 2) throw new Error('boom');
      return {} as any;
    });
    const err = await saveItemPatch(gql, data, 'item-1', { statusOptionId: 'done', dueDate: '2026-10-01', iterationId: 'i2' }).catch((e) => e);
    expect(err).toBeInstanceOf(PartialSaveError);
    expect(err.applied).toEqual({ statusOptionId: 'done' });
    expect(err.failedField).toBe('dueDate');
    expect(gql).toHaveBeenCalledTimes(2);
  });

  it('rethrows the original error when nothing was written', async () => {
    const gql = vi.fn(async () => {
      throw new Error('denied');
    });
    const err = await saveItemPatch(gql, data, 'item-1', { dueDate: '2026-10-01' }).catch((e) => e);
    expect(err).not.toBeInstanceOf(PartialSaveError);
    expect(err.message).toBe('denied');
  });

  it('validates all fields before writing any', async () => {
    const gql = vi.fn(async () => ({}) as any);
    const noIter = { ...data, fields: { ...data.fields, iteration: null } };
    await expect(saveItemPatch(gql, noIter, 'item-1', { statusOptionId: 'done', iterationId: 'i2' })).rejects.toThrow(/no iteration field/);
    expect(gql).not.toHaveBeenCalled();
  });

  it('refuses to write a field the board does not have', async () => {
    const noDue = { ...data, fields: { ...data.fields, dueDate: null } };
    await expect(saveItemPatch(vi.fn(), noDue, 'item-1', { dueDate: '2026-01-01' })).rejects.toThrow(/no due date field/);
  });
});

describe('createGraphQLClient', () => {
  it('sends a bearer token and surfaces GraphQL errors', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'Resource not accessible' }] }), { status: 200 }));
    const gql = createGraphQLClient({ getToken: () => 'tok', fetchImpl: fetchImpl as any });
    await expect(gql('query { viewer { login } }')).rejects.toThrow('Resource not accessible');
    const [, init] = fetchImpl.mock.calls[0] as any[];
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('fails fast without a token', async () => {
    const fetchImpl = vi.fn();
    const gql = createGraphQLClient({ getToken: () => null, fetchImpl: fetchImpl as any });
    await expect(gql('query { viewer { login } }')).rejects.toThrow(/Not signed in/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('PatAuthProvider', () => {
  it('keeps the token in memory only and notifies listeners', async () => {
    const auth = new PatAuthProvider([]);
    const listener = vi.fn();
    auth.subscribe(listener);
    await expect(auth.signIn('  ')).rejects.toThrow();
    await auth.signIn('  ghp_x  ');
    expect(auth.getToken()).toBe('ghp_x');
    expect(new PatAuthProvider([]).getToken()).toBeNull();
    auth.signOut();
    expect(auth.getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('removes a previously saved token from every storage on startup and never writes one', async () => {
    const stores = [new Map([[LEGACY_TOKEN_KEY, 'old'], ['other', 'keep']]), new Map([[LEGACY_TOKEN_KEY, 'old']])];
    const storages = stores.map((m) => ({ removeItem: (k: string) => void m.delete(k), setItem: vi.fn() }));
    const auth = new PatAuthProvider(storages);
    expect(stores.map((m) => [...m.keys()])).toEqual([['other'], []]);
    await auth.signIn('ghp_x');
    expect(storages.every((st) => st.setItem.mock.calls.length === 0)).toBe(true);
  });

  it('tolerates storage that throws', () => {
    const broken = { removeItem: () => { throw new Error('SecurityError'); } };
    expect(() => new PatAuthProvider([broken])).not.toThrow();
  });
});
