import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseProjectsConfig } from '../src/lib/config';
import type { RawBoard, RawItem } from '../src/lib/normalize';
import type { ProjectConfig } from '../src/lib/types';

const root = path.resolve(import.meta.dirname, '..');

export function loadConfig(): ProjectConfig {
  return parseProjectsConfig(readFileSync(path.join(root, 'projects.yml'), 'utf8'))[0];
}

export function loadFixtureBoard(): RawBoard {
  return JSON.parse(readFileSync(path.join(root, 'fixtures', 'benchmark.graphql.json'), 'utf8'));
}

export function rawIssueItem(over: {
  id?: string;
  number?: number;
  repo?: string;
  state?: 'OPEN' | 'CLOSED';
  assignedAt?: string[];
  values?: RawItem['fieldValues']['nodes'];
  closedAt?: string | null;
}): RawItem {
  const number = over.number ?? 1;
  return {
    id: over.id ?? `item-${number}`,
    type: 'ISSUE',
    content: {
      __typename: 'Issue',
      id: `issue-${number}`,
      number,
      title: `Issue ${number}`,
      url: `https://github.com/${over.repo ?? 'o/r'}/issues/${number}`,
      state: over.state ?? 'OPEN',
      createdAt: '2026-09-01T00:00:00Z',
      closedAt: over.closedAt ?? null,
      repository: { nameWithOwner: over.repo ?? 'o/r' },
      assignees: { nodes: [{ login: 'alice' }] },
      labels: { nodes: [{ name: 'bug', color: 'd73a4a' }] },
      timelineItems: { nodes: (over.assignedAt ?? []).map((createdAt) => ({ createdAt })) },
    },
    fieldValues: { nodes: over.values ?? [] },
  };
}

export const testConfig: ProjectConfig = {
  id: 't',
  name: 'Test',
  repos: ['o/r'],
  board: { owner: 'me', ownerType: 'user', number: 7 },
  fields: { status: 'Status', dueDate: 'Due date', iteration: 'Iteration' },
  autoAddIssues: false,
};

export function testBoard(items: (RawItem | null)[]): RawBoard {
  return {
    id: 'PVT_1',
    title: 'Board',
    url: 'https://github.com/users/me/projects/7',
    fields: {
      nodes: [
        {
          __typename: 'ProjectV2SingleSelectField',
          id: 'F_status',
          name: 'Status',
          dataType: 'SINGLE_SELECT',
          options: [
            { id: 'todo', name: 'Todo', color: 'GRAY' },
            { id: 'doing', name: 'Doing', color: 'YELLOW' },
            { id: 'done', name: 'Done', color: 'GREEN' },
          ],
        },
        { __typename: 'ProjectV2Field', id: 'F_due', name: 'Due date', dataType: 'DATE' },
        {
          __typename: 'ProjectV2IterationField',
          id: 'F_iter',
          name: 'Iteration',
          dataType: 'ITERATION',
          configuration: {
            completedIterations: [{ id: 'i1', title: 'Sprint 1', startDate: '2026-09-01', duration: 14 }],
            iterations: [
              { id: 'i3', title: 'Sprint 3', startDate: '2026-09-29', duration: 14 },
              { id: 'i2', title: 'Sprint 2', startDate: '2026-09-15', duration: 14 },
            ],
          },
        },
      ],
    },
    items: { nodes: items },
  };
}

export const status = (optionId: string) => ({
  __typename: 'ProjectV2ItemFieldSingleSelectValue',
  optionId,
  field: { id: 'F_status' },
});
export const due = (date: string) => ({ __typename: 'ProjectV2ItemFieldDateValue', date, field: { id: 'F_due' } });
export const iter = (iterationId: string) => ({
  __typename: 'ProjectV2ItemFieldIterationValue',
  iterationId,
  field: { id: 'F_iter' },
});
