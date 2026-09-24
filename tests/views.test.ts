import { describe, expect, it } from 'vitest';
import { normalizeBoard } from '../src/lib/normalize';
import {
  applyItemPatch,
  buildGantt,
  filterItems,
  fromDay,
  ganttRow,
  groupKanban,
  iterationEnd,
  NO_ASSIGNEE,
  NO_ITERATION,
  MAX_DAYS_FROM_TODAY,
  mondays,
  monthStarts,
  NO_STATUS,
  rollbackPatch,
  toDay,
} from '../src/lib/views';
import { due, iter, loadConfig, loadFixtureBoard, rawIssueItem, status, testBoard, testConfig } from './helpers';

const today = new Date('2026-09-23T12:00:00Z');

describe('dates', () => {
  it('round-trips day numbers and ignores time of day', () => {
    expect(fromDay(toDay('2026-09-23'))).toBe('2026-09-23');
    expect(toDay('2026-09-23T23:59:59Z')).toBe(toDay('2026-09-23'));
    expect(toDay('2026-03-01') - toDay('2026-02-28')).toBe(1);
  });

  it('computes inclusive iteration end', () => {
    expect(iterationEnd({ id: 'x', title: 'x', startDate: '2026-09-14', duration: 14, completed: false })).toBe('2026-09-27');
  });

  it('rejects garbage', () => {
    expect(() => toDay('soon')).toThrow();
  });
});

describe('groupKanban', () => {
  it('creates one column per status option in board order', () => {
    const data = normalizeBoard(
      testBoard([
        rawIssueItem({ number: 1, values: [status('done')] }),
        rawIssueItem({ number: 2, values: [status('todo')] }),
        rawIssueItem({ number: 3, values: [status('todo')] }),
      ]),
      testConfig,
    );
    const cols = groupKanban(data);
    expect(cols.map((c) => [c.name, c.items.map((i) => i.issue.number)])).toEqual([
      ['Todo', [2, 3]],
      ['Doing', []],
      ['Done', [1]],
    ]);
  });

  it('adds a leading "No status" column for unset or unknown options', () => {
    const data = normalizeBoard(
      testBoard([rawIssueItem({ number: 1 }), rawIssueItem({ number: 2, values: [status('deleted-option')] })]),
      testConfig,
    );
    const cols = groupKanban(data);
    expect(cols[0]).toMatchObject({ id: NO_STATUS, name: 'No status' });
    expect(cols[0].items.map((i) => i.issue.number)).toEqual([1, 2]);
  });

  it('groups the fixture into its 5 status columns plus No status', () => {
    const data = normalizeBoard(loadFixtureBoard(), loadConfig());
    const cols = groupKanban(data);
    expect(cols.map((c) => c.name)).toEqual(['No status', 'Todo', 'In Progress', 'Blocked', 'In Review', 'Done']);
    expect(cols.reduce((n, c) => n + c.items.length, 0)).toBe(24);
  });
});

describe('ganttRow', () => {
  const todayDay = toDay(today.toISOString());
  const mk = (o: Parameters<typeof rawIssueItem>[0]) => normalizeBoard(testBoard([rawIssueItem(o)]), testConfig).items[0];

  it('spans first assignment to due date', () => {
    const row = ganttRow(mk({ assignedAt: ['2026-09-20T09:00:00Z'], values: [due('2026-10-01')] }), todayDay)!;
    expect(row).toMatchObject({ kind: 'bar', overdue: false });
    expect(fromDay(row.startDay)).toBe('2026-09-20');
    expect(fromDay(row.endDay)).toBe('2026-10-01');
  });

  it('flags open issues past their due date as overdue, but not closed ones', () => {
    expect(ganttRow(mk({ assignedAt: ['2026-09-01T00:00:00Z'], values: [due('2026-09-10')] }), todayDay)!.overdue).toBe(true);
    expect(
      ganttRow(mk({ state: 'CLOSED', assignedAt: ['2026-09-01T00:00:00Z'], values: [due('2026-09-10')] }), todayDay)!.overdue,
    ).toBe(false);
  });

  it('runs open-ended bars to today, or to close date for closed issues', () => {
    const open = ganttRow(mk({ assignedAt: ['2026-09-15T00:00:00Z'] }), todayDay)!;
    expect(open.kind).toBe('open-ended');
    expect(fromDay(open.endDay)).toBe('2026-09-23');
    const closed = ganttRow(mk({ state: 'CLOSED', closedAt: '2026-09-18T00:00:00Z', assignedAt: ['2026-09-15T00:00:00Z'] }), todayDay)!;
    expect(fromDay(closed.endDay)).toBe('2026-09-18');
  });

  it('shows a milestone when only a due date exists', () => {
    const row = ganttRow(mk({ values: [due('2026-10-05')] }), todayDay)!;
    expect(row.kind).toBe('due-only');
    expect(row.startDay).toBe(row.endDay);
  });

  it('marks bars assigned after their due date as inverted', () => {
    const row = ganttRow(mk({ assignedAt: ['2026-09-20T00:00:00Z'], values: [due('2026-09-18')] }), todayDay)!;
    expect(row.kind).toBe('inverted');
    expect(fromDay(row.startDay)).toBe('2026-09-18');
    expect(row.overdue).toBe(true);
  });

  it('returns null when there is nothing to draw', () => {
    expect(ganttRow(mk({}), todayDay)).toBeNull();
  });
});

describe('buildGantt', () => {
  it('groups rows by iteration in start-date order and puts the rest in "No iteration"', () => {
    const data = normalizeBoard(
      testBoard([
        rawIssueItem({ number: 1, assignedAt: ['2026-09-16T00:00:00Z'], values: [due('2026-09-25'), iter('i2')] }),
        rawIssueItem({ number: 2, assignedAt: ['2026-09-02T00:00:00Z'], values: [due('2026-09-12'), iter('i1')] }),
        rawIssueItem({ number: 3, values: [due('2026-10-20')] }),
        rawIssueItem({ number: 4, values: [iter('i3')] }),
        rawIssueItem({ number: 5, assignedAt: ['2026-09-15T00:00:00Z'], values: [due('2026-09-20'), iter('i2')] }),
      ]),
      testConfig,
    );
    const g = buildGantt(data, data.items, today);
    expect(g.groups.map((x) => [x.title, x.rows.map((r) => r.item.issue.number)])).toEqual([
      ['Sprint 1', [2]],
      ['Sprint 2', [5, 1]],
      ['No iteration', [3]],
    ]);
    expect(g.groups.at(-1)!.id).toBe(NO_ITERATION);
    expect(g.unscheduled.map((i) => i.issue.number)).toEqual([4]);
    expect(fromDay(g.minDay)).toBe('2026-09-01');
    expect(fromDay(g.maxDay)).toBe('2026-10-20');
    expect(fromDay(g.todayDay)).toBe('2026-09-23');
  });

  it('always includes today in the range', () => {
    const data = normalizeBoard(testBoard([rawIssueItem({ values: [due('2026-12-01')] })]), testConfig);
    expect(fromDay(buildGantt(data, data.items, today).minDay)).toBe('2026-09-23');
  });

  it('places every fixture issue either on the timeline or in unscheduled', () => {
    const data = normalizeBoard(loadFixtureBoard(), loadConfig());
    const g = buildGantt(data, data.items, today);
    const rows = g.groups.reduce((n, x) => n + x.rows.length, 0);
    expect(rows + g.unscheduled.length).toBe(24);
    expect(g.unscheduled.map((i) => i.issue.number)).toEqual([14, 18, 24, 30]);
  });
});

describe('filterItems / applyItemPatch', () => {
  const data = normalizeBoard(loadFixtureBoard(), loadConfig());

  it('hides closed issues unless requested', () => {
    expect(filterItems(data.items, {})).toHaveLength(20);
    expect(filterItems(data.items, { showClosed: true })).toHaveLength(24);
  });

  it('filters by text, #number, assignee, unassigned and label', () => {
    expect(filterItems(data.items, { text: 'glm' }).map((i) => i.issue.number)).toEqual([12, 32]);
    expect(filterItems(data.items, { text: '#27' }).map((i) => i.issue.number)).toEqual([27]);
    expect(filterItems(data.items, { assignee: 'andrei-kochin' }).map((i) => i.issue.number)).toEqual([7, 13, 16, 27]);
    expect(filterItems(data.items, { assignee: NO_ASSIGNEE }).every((i) => i.issue.assignees.length === 0)).toBe(true);
    expect(filterItems(data.items, { label: 'benchmark-request' })).toHaveLength(5);
  });

  it('patches one item immutably', () => {
    const target = data.items[0];
    const next = applyItemPatch(data, target.itemId, { statusOptionId: 'opt_blocked', dueDate: null });
    expect(next).not.toBe(data);
    expect(next.items[0]).toMatchObject({ statusOptionId: 'opt_blocked', dueDate: null, iterationId: target.iterationId });
    expect(data.items[0]).toBe(target);
    expect(next.items[1]).toBe(data.items[1]);
  });

  it('returns the same object for an unknown item', () => {
    expect(applyItemPatch(data, 'nope', { dueDate: '2026-01-01' })).toBe(data);
  });
});

describe('rollbackPatch', () => {
  it('restores only fields GitHub did not accept', () => {
    const original = { statusOptionId: 'todo', dueDate: null, iterationId: 'i1' };
    expect(rollbackPatch(original, { statusOptionId: 'done' })).toEqual({ dueDate: null, iterationId: 'i1' });
    expect(rollbackPatch(original, {})).toEqual(original);
    expect(rollbackPatch(original, { statusOptionId: 'done', dueDate: '2026-10-01', iterationId: 'i2' })).toEqual({});
  });
});

describe('timeline range cap', () => {
  it('clamps outlier dates to a bounded window and flags clipped rows', () => {
    const data = normalizeBoard(
      testBoard([
        rawIssueItem({ number: 1, values: [due('9999-12-31')] }),
        rawIssueItem({ number: 2, assignedAt: ['1990-01-01T00:00:00Z'], values: [due('2026-09-30')] }),
        rawIssueItem({ number: 3, assignedAt: ['2026-09-20T00:00:00Z'], values: [due('2026-10-01')] }),
      ]),
      testConfig,
    );
    const g = buildGantt(data, data.items, today);
    expect(g.maxDay - g.todayDay).toBe(MAX_DAYS_FROM_TODAY);
    expect(g.todayDay - g.minDay).toBe(MAX_DAYS_FROM_TODAY);
    const rows = new Map(g.groups.flatMap((x) => x.rows).map((r) => [r.item.issue.number, r]));
    expect([rows.get(1)!.clippedStart, rows.get(1)!.clippedEnd]).toEqual([false, true]);
    expect([rows.get(2)!.clippedStart, rows.get(2)!.clippedEnd]).toEqual([true, false]);
    expect([rows.get(3)!.clippedStart, rows.get(3)!.clippedEnd]).toEqual([false, false]);
  });

  it('does not widen a small range', () => {
    const data = normalizeBoard(testBoard([rawIssueItem({ assignedAt: ['2026-09-20T00:00:00Z'], values: [due('2026-10-01')] })]), testConfig);
    const g = buildGantt(data, data.items, today);
    expect([fromDay(g.minDay), fromDay(g.maxDay)]).toEqual(['2026-09-20', '2026-10-01']);
  });
});

describe('tick generators', () => {
  it('lists month starts across a year boundary', () => {
    expect(monthStarts(toDay('2026-11-15'), toDay('2027-02-01')).map(fromDay)).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
    expect(monthStarts(toDay('2026-09-01'), toDay('2026-09-30')).map(fromDay)).toEqual(['2026-09-01']);
  });

  it('lists Mondays', () => {
    expect(mondays(toDay('2026-09-23'), toDay('2026-10-12')).map(fromDay)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(mondays(toDay('2026-09-21'), toDay('2026-09-21')).map(fromDay)).toEqual(['2026-09-21']);
  });
});
