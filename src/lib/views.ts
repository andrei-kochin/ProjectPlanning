import type { Iteration, PlanItem, ProjectData, StatusOption } from './types';

export const NO_STATUS = '__none__';
export const NO_ITERATION = '__none__';
export const NO_ASSIGNEE = '__none__';

export interface KanbanColumn {
  id: string;
  name: string;
  color: string | null;
  items: PlanItem[];
}

/** Columns follow the board's Status option order, plus a leading "No status" column when needed. */
export function groupKanban(data: ProjectData, items: PlanItem[] = data.items): KanbanColumn[] {
  const options: StatusOption[] = data.fields.status?.options ?? [];
  const known = new Set(options.map((o) => o.id));
  const cols: KanbanColumn[] = options.map((o) => ({ id: o.id, name: o.name, color: o.color, items: [] }));
  const byId = new Map(cols.map((c) => [c.id, c]));
  const none: KanbanColumn = { id: NO_STATUS, name: 'No status', color: null, items: [] };
  for (const item of items) {
    const col = item.statusOptionId && known.has(item.statusOptionId) ? byId.get(item.statusOptionId)! : none;
    col.items.push(item);
  }
  return none.items.length > 0 || cols.length === 0 ? [none, ...cols] : cols;
}

/* ---------- dates (UTC day numbers, so rendering never drifts with the viewer's timezone) ---------- */

const DAY = 86_400_000;

/** Parses YYYY-MM-DD or an ISO timestamp to a UTC day number. */
export function toDay(d: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) throw new Error(`Invalid date: ${d}`);
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
}

export function fromDay(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

export function iterationEnd(it: Iteration): string {
  return fromDay(toDay(it.startDate) + it.duration - 1);
}

/* ---------- gantt ---------- */

export type GanttKind =
  | 'bar' // assigned and has a due date
  | 'open-ended' // assigned, no due date: bar runs to today
  | 'due-only' // has due date but never assigned: milestone marker
  | 'inverted'; // assigned after its due date

export interface GanttRow {
  item: PlanItem;
  kind: GanttKind;
  startDay: number;
  endDay: number;
  overdue: boolean;
}

export interface GanttGroup {
  id: string;
  title: string;
  iteration: Iteration | null;
  rows: GanttRow[];
}

export interface GanttModel {
  groups: GanttGroup[];
  unscheduled: PlanItem[];
  minDay: number;
  maxDay: number;
  todayDay: number;
}

export function ganttRow(item: PlanItem, todayDay: number): GanttRow | null {
  const start = item.firstAssignedAt ? toDay(item.firstAssignedAt) : null;
  const due = item.dueDate ? toDay(item.dueDate) : null;
  const open = item.issue.state === 'OPEN';
  const overdue = open && due !== null && due < todayDay;
  if (start !== null && due !== null) {
    return start <= due
      ? { item, kind: 'bar', startDay: start, endDay: due, overdue }
      : { item, kind: 'inverted', startDay: due, endDay: start, overdue };
  }
  if (start !== null) {
    const end = !open && item.issue.closedAt ? toDay(item.issue.closedAt) : todayDay;
    return { item, kind: 'open-ended', startDay: start, endDay: Math.max(start, end), overdue: false };
  }
  if (due !== null) return { item, kind: 'due-only', startDay: due, endDay: due, overdue };
  return null;
}

export function buildGantt(data: ProjectData, items: PlanItem[] = data.items, today = new Date()): GanttModel {
  const todayDay = toDay(today.toISOString());
  const iterations = data.fields.iteration?.iterations ?? [];
  const groups: GanttGroup[] = iterations.map((it) => ({ id: it.id, title: it.title, iteration: it, rows: [] }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  const none: GanttGroup = { id: NO_ITERATION, title: 'No iteration', iteration: null, rows: [] };
  const unscheduled: PlanItem[] = [];

  for (const item of items) {
    const row = ganttRow(item, todayDay);
    if (!row) {
      unscheduled.push(item);
      continue;
    }
    ((item.iterationId && byId.get(item.iterationId)) || none).rows.push(row);
  }

  const all = [...groups, none];
  for (const g of all) g.rows.sort((a, b) => a.startDay - b.startDay || a.endDay - b.endDay);

  const days = [todayDay];
  for (const g of all) {
    for (const r of g.rows) days.push(r.startDay, r.endDay);
    if (g.iteration && g.rows.length) {
      days.push(toDay(g.iteration.startDate), toDay(iterationEnd(g.iteration)));
    }
  }
  return {
    groups: all.filter((g) => g.rows.length > 0),
    unscheduled,
    minDay: Math.min(...days),
    maxDay: Math.max(...days),
    todayDay,
  };
}

/* ---------- filtering & local updates ---------- */

export interface ItemFilter {
  text?: string;
  assignee?: string;
  label?: string;
  showClosed?: boolean;
}

export function filterItems(items: PlanItem[], f: ItemFilter): PlanItem[] {
  const text = f.text?.trim().toLowerCase();
  return items.filter((i) => {
    if (!f.showClosed && i.issue.state === 'CLOSED') return false;
    if (f.assignee) {
      const ok = f.assignee === NO_ASSIGNEE ? i.issue.assignees.length === 0 : i.issue.assignees.includes(f.assignee);
      if (!ok) return false;
    }
    if (f.label && !i.issue.labels.some((l) => l.name === f.label)) return false;
    if (text && !`#${i.issue.number} ${i.issue.title}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

export type ItemPatch = Partial<Pick<PlanItem, 'statusOptionId' | 'dueDate' | 'iterationId'>>;

export function applyItemPatch(data: ProjectData, itemId: string, patch: ItemPatch): ProjectData {
  let found = false;
  const items = data.items.map((i) => {
    if (i.itemId !== itemId) return i;
    found = true;
    return { ...i, ...patch };
  });
  return found ? { ...data, items } : data;
}

/** Local values to restore after a failed save: `original` minus the fields GitHub already accepted. */
export function rollbackPatch(original: ItemPatch, applied: ItemPatch): ItemPatch {
  const out: ItemPatch = {};
  for (const k of Object.keys(original) as (keyof ItemPatch)[]) {
    if (!(k in applied)) (out as Record<string, unknown>)[k] = original[k];
  }
  return out;
}

export function uniqueAssignees(items: PlanItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.issue.assignees))].sort((a, b) => a.localeCompare(b));
}

export function uniqueLabels(items: PlanItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.issue.labels.map((l) => l.name)))].sort((a, b) => a.localeCompare(b));
}
