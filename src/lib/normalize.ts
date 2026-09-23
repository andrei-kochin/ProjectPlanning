import type { Issue, Iteration, PlanItem, ProjectConfig, ProjectData, ProjectFields } from './types';

/* Raw shapes as returned by the queries in queries.ts. */

export interface RawIterationDef {
  id: string;
  title: string;
  startDate: string;
  duration: number;
}

export interface RawField {
  __typename: string;
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string; color: string }[];
  configuration?: { iterations: RawIterationDef[]; completedIterations: RawIterationDef[] };
}

export interface RawIssueContent {
  __typename: 'Issue';
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  repository: { nameWithOwner: string };
  assignees: { nodes: { login: string }[] };
  labels: { nodes: { name: string; color: string }[] };
  timelineItems: { nodes: ({ createdAt?: string } | null)[] };
}

export interface RawFieldValue {
  __typename: string;
  optionId?: string | null;
  date?: string | null;
  iterationId?: string | null;
  field?: { id?: string } | null;
}

export interface RawItem {
  id: string;
  type: string;
  isArchived?: boolean;
  content: RawIssueContent | { __typename: string } | null;
  fieldValues: { nodes: (RawFieldValue | null)[] };
}

export interface RawBoard {
  id: string;
  title: string;
  url: string;
  fields: { nodes: (RawField | null)[] };
  items: { nodes: (RawItem | null)[] };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function extractFields(board: RawBoard, cfg: ProjectConfig, warnings: string[] = []): ProjectFields {
  const fields = board.fields.nodes.filter((f): f is RawField => !!f);
  const find = (name: string, dataType: string, label: string) => {
    const f = fields.find((x) => sameName(x.name, name));
    if (!f) {
      warnings.push(`Field "${name}" (${label}) not found on board "${board.title}"`);
      return null;
    }
    if (f.dataType !== dataType) {
      warnings.push(`Field "${name}" is ${f.dataType}, expected ${dataType} for ${label}`);
      return null;
    }
    return f;
  };

  const status = find(cfg.fields.status, 'SINGLE_SELECT', 'status');
  const due = find(cfg.fields.dueDate, 'DATE', 'due date');
  const iter = find(cfg.fields.iteration, 'ITERATION', 'iteration');

  const iterations: Iteration[] = iter?.configuration
    ? [
        ...iter.configuration.completedIterations.map((i) => ({ ...i, completed: true })),
        ...iter.configuration.iterations.map((i) => ({ ...i, completed: false })),
      ].sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  return {
    status: status ? { id: status.id, name: status.name, options: status.options ?? [] } : null,
    dueDate: due ? { id: due.id, name: due.name } : null,
    iteration: iter ? { id: iter.id, name: iter.name, iterations } : null,
  };
}

function isIssue(c: RawItem['content']): c is RawIssueContent {
  return !!c && c.__typename === 'Issue';
}

export function normalizeItem(raw: RawItem, fields: ProjectFields): PlanItem | null {
  if (!isIssue(raw.content)) return null;
  const c = raw.content;
  const issue: Issue = {
    id: c.id,
    number: c.number,
    title: c.title,
    url: c.url,
    state: c.state,
    repo: c.repository.nameWithOwner,
    assignees: c.assignees.nodes.map((a) => a.login),
    labels: c.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
    createdAt: c.createdAt,
    closedAt: c.closedAt,
  };
  const valueFor = (fieldId: string | undefined) =>
    fieldId ? raw.fieldValues.nodes.find((v) => v?.field?.id === fieldId) ?? null : null;

  const firstAssignedAt =
    c.timelineItems.nodes
      .map((n) => n?.createdAt)
      .filter((d): d is string => !!d)
      .sort()[0] ?? null;

  return {
    itemId: raw.id,
    issue,
    statusOptionId: valueFor(fields.status?.id)?.optionId ?? null,
    dueDate: valueFor(fields.dueDate?.id)?.date ?? null,
    iterationId: valueFor(fields.iteration?.id)?.iterationId ?? null,
    firstAssignedAt,
  };
}

export function normalizeBoard(
  board: RawBoard,
  cfg: ProjectConfig,
  opts: { generatedAt?: string; fixture?: boolean } = {},
): ProjectData {
  const warnings: string[] = [];
  const fields = extractFields(board, cfg, warnings);
  const repos = new Set(cfg.repos.map((r) => r.toLowerCase()));
  const items = board.items.nodes
    .filter((n): n is RawItem => !!n && !n.isArchived)
    .map((n) => normalizeItem(n, fields))
    .filter((i): i is PlanItem => !!i && repos.has(i.issue.repo.toLowerCase()))
    .sort((a, b) => a.issue.repo.localeCompare(b.issue.repo) || a.issue.number - b.issue.number);

  return {
    id: cfg.id,
    name: cfg.name,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    fixture: opts.fixture ?? false,
    config: cfg,
    repos: cfg.repos,
    board: {
      projectId: board.id,
      owner: cfg.board.owner,
      ownerType: cfg.board.ownerType,
      number: cfg.board.number,
      title: board.title,
      url: board.url,
    },
    fields,
    items,
    warnings,
  };
}
