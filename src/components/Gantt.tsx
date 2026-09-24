import { useMemo } from 'react';
import { optionColor, readableTextOn } from '../lib/colors';
import type { PlanItem, ProjectData } from '../lib/types';
import { buildGantt, clampDay, fromDay, iterationEnd, MAX_DAYS_FROM_TODAY, mondays, monthStarts, toDay, type GanttRow } from '../lib/views';
import { useToday } from '../lib/useToday';
import { Avatars, formatDate, IssueRef } from './IssueBits';

interface Props {
  data: ProjectData;
  items: PlanItem[];
  onOpen: (item: PlanItem) => void;
}

const PX = 22;
const LABEL_W = 340;
const PAD = 3;

function describe(row: GanttRow): string {
  const i = row.item;
  const parts = [`#${i.issue.number} ${i.issue.title}`];
  if (i.firstAssignedAt) parts.push(`First assigned: ${i.firstAssignedAt.slice(0, 10)}`);
  parts.push(i.dueDate ? `Due: ${i.dueDate}` : 'No due date');
  if (row.kind === 'inverted') parts.push('Assigned after its due date');
  if (row.kind === 'open-ended') parts.push(i.issue.state === 'CLOSED' ? 'Shown until it was closed' : 'Shown until today');
  if (i.issue.state === 'CLOSED') parts.push('Closed');
  if (row.overdue) parts.push('Overdue');
  if (row.clippedStart) parts.push('Starts before the shown range');
  if (row.clippedEnd) parts.push('Continues past the shown range');
  return parts.join('\n');
}

export function Gantt({ data, items, onOpen }: Props) {
  const today = useToday();
  const model = useMemo(() => buildGantt(data, items, today), [data, items, today]);
  const statusColor = useMemo(
    () => new Map((data.fields.status?.options ?? []).map((o) => [o.id, optionColor(o.color)])),
    [data],
  );

  const start = model.minDay - PAD;
  const end = model.maxDay + PAD;
  const days = end - start + 1;
  const width = days * PX;
  const x = (day: number) => (day - start) * PX;
  const firstMonday = start + ((7 - ((start + 3) % 7)) % 7);
  const grid = {
    width,
    backgroundImage: `repeating-linear-gradient(to right, var(--grid) 0 1px, transparent 1px ${PX * 7}px)`,
    backgroundPosition: `${x(firstMonday)}px 0`,
  };

  const clamp = (d: number) => clampDay(d, model.minDay, model.maxDay);
  const monthLabel = (d: number) =>
    new Date(`${fromDay(d)}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthDays = monthStarts(start, end);
  if (Number(fromDay(start).slice(8)) <= 24 && monthDays[0] !== start) monthDays.unshift(start);
  const months = monthDays.map((d) => ({ label: monthLabel(d), left: x(d) }));
  const weeks = mondays(start, end).map((d) => ({ label: fromDay(d).slice(8), left: x(d) }));
  const clipped = model.groups.some((g) => g.rows.some((r) => r.clippedStart || r.clippedEnd));

  if (model.groups.length === 0 && model.unscheduled.length === 0) {
    return <div className="empty">No issues match the current filters.</div>;
  }

  return (
    <div className="gantt-wrap">
      <div className="legend">
        <span><i className="lg lg-bar" /> first assigned → due date</span>
        <span><i className="lg lg-open" /> assigned, no due date (runs to today / close)</span>
        <span><i className="lg lg-due" /> due date, never assigned</span>
        <span><i className="lg lg-overdue" /> overdue</span>
        <span><i className="lg lg-today" /> today</span>
        {clipped && <span>◂ ▸ cut off: dates more than {MAX_DAYS_FROM_TODAY} days from today are not drawn</span>}
      </div>
      <div className="gantt" style={{ ['--label-w' as string]: `${LABEL_W}px` }}>
        <div className="g-inner" style={{ width: LABEL_W + width }}>
          <div className="g-head">
            <div className="g-label head">Issue</div>
            <div className="g-track head" style={{ width }}>
              {months.map((m) => (
                <span key={m.left} className="month" style={{ left: m.left }}>
                  {m.label}
                </span>
              ))}
              {weeks.map((w) => (
                <span key={w.left} className="week" style={{ left: w.left }}>
                  {w.label}
                </span>
              ))}
            </div>
          </div>

          <div className="g-body">
            <div className="today-line" style={{ left: LABEL_W + x(model.todayDay) + PX / 2 }} title={`Today ${fromDay(model.todayDay)}`} />
            {model.groups.map((g) => {
              const iterStart = g.iteration ? toDay(g.iteration.startDate) : 0;
              const iterEnd = g.iteration ? toDay(iterationEnd(g.iteration)) : 0;
              const band =
                g.iteration && iterEnd >= model.minDay && iterStart <= model.maxDay
                  ? { left: x(clamp(iterStart)), width: (clamp(iterEnd) - clamp(iterStart) + 1) * PX }
                  : null;
              return (
                <div key={g.id} className="g-group">
                  <div className="g-row group-row">
                    <div className="g-label">
                      <strong>{g.title}</strong>
                      {g.iteration && (
                        <span className="muted">
                          {formatDate(g.iteration.startDate)} – {formatDate(iterationEnd(g.iteration))}
                          {g.iteration.completed ? ' · completed' : ''}
                        </span>
                      )}
                      <span className="count">{g.rows.length}</span>
                    </div>
                    <div className="g-track" style={grid}>
                      {band && <div className="band head-band" style={band} />}
                    </div>
                  </div>
                  {g.rows.map((row) => {
                    const color = (row.item.statusOptionId && statusColor.get(row.item.statusOptionId)) || optionColor('GRAY');
                    const closed = row.item.issue.state === 'CLOSED';
                    return (
                      <div key={row.item.itemId} className="g-row" onClick={() => onOpen(row.item)}>
                        <div className="g-label">
                          <IssueRef issue={row.item.issue} />
                          <button type="button" className="title" title={`Edit: ${row.item.issue.title}`}>
                            {row.item.issue.title}
                          </button>
                          <Avatars logins={row.item.issue.assignees} size={18} />
                        </div>
                        <div className="g-track" style={grid} role="img" aria-label={describe(row).replace(/\n/g, '. ')}>
                          {band && <div className="band" style={band} />}
                          {row.kind === 'due-only' ? (
                            <div
                              className={`diamond ${row.overdue ? 'overdue' : ''} ${row.clippedStart || row.clippedEnd ? 'clipped' : ''}`}
                              style={{ left: x(clamp(row.startDay)) + PX / 2 - 7, ['--c' as string]: color }}
                              title={describe(row)}
                            />
                          ) : (
                            <div
                              className={`bar ${row.kind} ${row.overdue ? 'overdue' : ''} ${closed ? 'closed' : ''} ${row.clippedStart ? 'clip-start' : ''} ${row.clippedEnd ? 'clip-end' : ''}`}
                              style={{ left: x(clamp(row.startDay)), width: (clamp(row.endDay) - clamp(row.startDay) + 1) * PX, ['--c' as string]: color, ['--fg' as string]: readableTextOn(color) }}
                              title={describe(row)}
                            >
                              <span>{row.item.dueDate ? formatDate(row.item.dueDate) : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {model.unscheduled.length > 0 && (
        <div className="unscheduled">
          <h3>Not on the timeline ({model.unscheduled.length})</h3>
          <p className="muted">Never assigned and no due date. Click one to set a due date (assignment is managed on GitHub).</p>
          <div className="unscheduled-list">
            {model.unscheduled.map((i) => (
              <button key={i.itemId} className="pill" onClick={() => onOpen(i)}>
                #{i.issue.number} {i.issue.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
