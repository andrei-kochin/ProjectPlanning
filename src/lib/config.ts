import { parse } from 'yaml';
import type { OwnerType, ProjectConfig } from './types';

const DEFAULT_FIELDS = { status: 'Status', dueDate: 'Due date', iteration: 'Iteration' };

function fail(msg: string): never {
  throw new Error(`projects.yml: ${msg}`);
}

function str(v: unknown, where: string): string {
  if (typeof v !== 'string' || v.trim() === '') fail(`${where} must be a non-empty string`);
  return v.trim();
}

export function parseProjectsConfig(text: string): ProjectConfig[] {
  const doc = parse(text) as { projects?: unknown } | null;
  if (!doc || !Array.isArray(doc.projects)) fail('expected a top-level `projects:` list');
  const seen = new Set<string>();
  return doc.projects.map((raw, i) => {
    const p = (raw ?? {}) as Record<string, any>;
    const where = `projects[${i}]`;
    const id = str(p.id, `${where}.id`);
    if (!/^[a-z0-9][a-z0-9-_]*$/i.test(id)) fail(`${where}.id must be URL-safe (letters, digits, - and _)`);
    if (seen.has(id)) fail(`duplicate project id "${id}"`);
    seen.add(id);

    const repos = Array.isArray(p.repos) ? p.repos : p.repo ? [p.repo] : [];
    if (repos.length === 0) fail(`${where}.repos must list at least one owner/name`);
    const repoNames = repos.map((r: unknown, j: number) => {
      const s = str(r, `${where}.repos[${j}]`);
      if (!/^[^/\s]+\/[^/\s]+$/.test(s)) fail(`${where}.repos[${j}] must look like owner/name`);
      return s;
    });

    const b = (p.board ?? {}) as Record<string, unknown>;
    const ownerType = (b.ownerType ?? 'user') as OwnerType;
    if (ownerType !== 'user' && ownerType !== 'organization') {
      fail(`${where}.board.ownerType must be "user" or "organization"`);
    }
    const number = Number(b.number);
    if (!Number.isInteger(number) || number <= 0) fail(`${where}.board.number must be a positive integer`);

    const f = (p.fields ?? {}) as Record<string, unknown>;
    return {
      id,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : id,
      repos: repoNames,
      board: { owner: str(b.owner, `${where}.board.owner`), ownerType, number },
      fields: {
        status: typeof f.status === 'string' ? f.status : DEFAULT_FIELDS.status,
        dueDate: typeof f.dueDate === 'string' ? f.dueDate : DEFAULT_FIELDS.dueDate,
        iteration: typeof f.iteration === 'string' ? f.iteration : DEFAULT_FIELDS.iteration,
      },
      autoAddIssues: p.autoAddIssues === true,
    };
  });
}
