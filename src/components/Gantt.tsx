import { useMemo } from 'react';
import { optionColor } from '../lib/colors';
import type { PlanItem, ProjectData } from '../lib/types';
import { buildGantt, fromDay, iterationEnd, toDay, type GanttRow } from '../lib/views';
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
  if (row.overdue) parts.push('Overdue');
  return parts.join('\n');
}

export function Gantt({ data, items, onOpen }: Props) {
  const model = useMemo(() => buildGantt(data, items), [data, items]);
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

  const months: { label: string; left: number }[] = [];
  const weeks: { label: string; left: number }[] = [];
  for (let d = start; d <= end; d++) {
    const iso = fromDay(d);
    const monthStartsSoon = d === start && Number(iso.slice(8)) > 24;
    if (iso.endsWith('-01') || (d === start && !monthStartsSoon)) {
      const dt = new Date(`${iso}T00:00:00Z`);
      months.push({ label: dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }), left: x(d) });
    }
    if ((d + 3) % 7 === 0) weeks.push({ label: iso.slice(8), left: x(d) });
  }

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
              const band = g.iteration
                ? { left: x(toDay(g.iteration.startDate)), width: g.iteration.duration * PX }
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
                        <div className="g-track" style={grid}>
                          {band && <div className="band" style={band} />}
                          {row.kind === 'due-only' ? (
                            <div
                              className={`diamond ${row.overdue ? 'overdue' : ''}`}
                              style={{ left: x(row.startDay) + PX / 2 - 7, ['--c' as string]: color }}
                              title={describe(row)}
                            />
                          ) : (
                            <div
                              className={`bar ${row.kind} ${row.overdue ? 'overdue' : ''} ${closed ? 'closed' : ''}`}
                              style={{ left: x(row.startDay), width: (row.endDay - row.startDay + 1) * PX, ['--c' as string]: color }}
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
          <p className="muted">Never assigned and no due date. Click one to set a due date or iteration.</p>
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
