import { describe, expect, it } from 'vitest';
import { parseProjectsConfig } from '../src/lib/config';
import { loadConfig } from './helpers';

describe('parseProjectsConfig', () => {
  it('parses the committed projects.yml', () => {
    const cfg = loadConfig();
    expect(cfg).toMatchObject({
      id: 'benchmark',
      repos: ['itikhono/benchmark'],
      board: { owner: 'andrei-kochin', ownerType: 'user' },
      fields: { status: 'Status', dueDate: 'Due date', iteration: 'Iteration' },
      autoAddIssues: false,
    });
  });

  it('applies defaults for name, field names and ownerType', () => {
    const [p] = parseProjectsConfig(`
projects:
  - id: x
    repo: a/b
    board: { owner: someone, number: 3 }
`);
    expect(p.name).toBe('x');
    expect(p.repos).toEqual(['a/b']);
    expect(p.board.ownerType).toBe('user');
    expect(p.fields).toEqual({ status: 'Status', dueDate: 'Due date', iteration: 'Iteration' });
  });

  it('drops duplicate repos case-insensitively, keeping the first spelling', () => {
    const [p] = parseProjectsConfig('projects: [{ id: x, repos: [Owner/Repo, a/b, owner/repo], board: { owner: o, number: 1 } }]');
    expect(p.repos).toEqual(['Owner/Repo', 'a/b']);
  });

  it.each([
    ['missing list', 'foo: 1', /top-level `projects:`/],
    ['bad repo', 'projects: [{ id: x, repos: [nope], board: { owner: o, number: 1 } }]', /owner\/name/],
    ['bad number', 'projects: [{ id: x, repos: [a/b], board: { owner: o, number: 0 } }]', /positive integer/],
    ['bad owner type', 'projects: [{ id: x, repos: [a/b], board: { owner: o, number: 1, ownerType: team } }]', /ownerType/],
    [
      'duplicate id',
      'projects: [{ id: x, repos: [a/b], board: { owner: o, number: 1 } }, { id: x, repos: [a/b], board: { owner: o, number: 2 } }]',
      /duplicate/,
    ],
    ['unsafe id', 'projects: [{ id: "a b", repos: [a/b], board: { owner: o, number: 1 } }]', /URL-safe/],
  ])('rejects %s', (_name, yml, err) => {
    expect(() => parseProjectsConfig(yml)).toThrow(err);
  });
});
