import { describe, expect, it } from 'vitest';
import { normalizeBoard } from '../src/lib/normalize';
import { due, iter, loadConfig, loadFixtureBoard, rawIssueItem, status, testBoard, testConfig } from './helpers';

describe('normalizeBoard', () => {
  it('extracts status options, due date and iterations (completed first, sorted by start)', () => {
    const data = normalizeBoard(testBoard([]), testConfig);
    expect(data.fields.status?.options.map((o) => o.name)).toEqual(['Todo', 'Doing', 'Done']);
    expect(data.fields.dueDate).toEqual({ id: 'F_due', name: 'Due date' });
    expect(data.fields.iteration?.iterations.map((i) => [i.title, i.completed])).toEqual([
      ['Sprint 1', true],
      ['Sprint 2', false],
      ['Sprint 3', false],
    ]);
    expect(data.warnings).toEqual([]);
    expect(data.config).toBe(testConfig);
  });

  it('maps field values to the configured fields by id', () => {
    const data = normalizeBoard(
      testBoard([rawIssueItem({ values: [status('doing'), due('2026-10-01'), iter('i2'), { __typename: 'ProjectV2ItemFieldTextValue' }] })]),
      testConfig,
    );
    expect(data.items[0]).toMatchObject({
      itemId: 'item-1',
      statusOptionId: 'doing',
      dueDate: '2026-10-01',
      iterationId: 'i2',
      issue: { number: 1, repo: 'o/r', assignees: ['alice'], labels: [{ name: 'bug', color: 'd73a4a' }] },
    });
  });

  it('uses the earliest assigned event as firstAssignedAt', () => {
    const data = normalizeBoard(
      testBoard([rawIssueItem({ assignedAt: ['2026-09-10T10:00:00Z', '2026-09-03T08:00:00Z'] })]),
      testConfig,
    );
    expect(data.items[0].firstAssignedAt).toBe('2026-09-03T08:00:00Z');
  });

  it('leaves values null when missing', () => {
    const [item] = normalizeBoard(testBoard([rawIssueItem({})]), testConfig).items;
    expect(item).toMatchObject({ statusOptionId: null, dueDate: null, iterationId: null, firstAssignedAt: null });
  });

  it('drops non-issues, archived items and issues from other repos; sorts by number', () => {
    const board = testBoard([
      rawIssueItem({ number: 5 }),
      rawIssueItem({ number: 2 }),
      rawIssueItem({ number: 9, repo: 'other/repo' }),
      { ...rawIssueItem({ number: 3 }), isArchived: true },
      { id: 'draft', type: 'DRAFT_ISSUE', content: { __typename: 'DraftIssue' }, fieldValues: { nodes: [] } },
      null,
    ]);
    const data = normalizeBoard(board, testConfig);
    expect(data.items.map((i) => i.issue.number)).toEqual([2, 5]);
  });

  it('matches field names case-insensitively and warns on missing or mistyped fields', () => {
    const cfg = { ...testConfig, fields: { status: 'status', dueDate: 'Iteration', iteration: 'Sprint' } };
    const data = normalizeBoard(testBoard([]), cfg);
    expect(data.fields.status?.id).toBe('F_status');
    expect(data.fields.dueDate).toBeNull();
    expect(data.fields.iteration).toBeNull();
    expect(data.warnings).toEqual([
      'Field "Iteration" is ITERATION, expected DATE for due date',
      'Field "Sprint" (iteration) not found on board "Board"',
    ]);
  });

  it('normalizes the benchmark fixture', () => {
    const data = normalizeBoard(loadFixtureBoard(), loadConfig(), { fixture: true });
    expect(data.fixture).toBe(true);
    expect(data.items).toHaveLength(24);
    expect(data.warnings).toEqual([]);
    expect(data.items.every((i) => i.issue.repo === 'itikhono/benchmark')).toBe(true);
    const i32 = data.items.find((i) => i.issue.number === 32)!;
    expect(i32).toMatchObject({ statusOptionId: 'opt_todo', dueDate: '2026-10-14', iterationId: 'it_s4' });
    expect(i32.issue.labels.map((l) => l.name)).toEqual(['benchmark-request']);
  });
});
