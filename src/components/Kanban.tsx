import { useMemo, useState } from 'react';
import { optionColor } from '../lib/colors';
import type { PlanItem, ProjectData } from '../lib/types';
import { groupKanban, NO_STATUS, toDay } from '../lib/views';
import { Avatars, formatDate, IssueRef, LabelChip } from './IssueBits';

interface Props {
  data: ProjectData;
  items: PlanItem[];
  savingIds: Set<string>;
  onMove: (item: PlanItem, statusOptionId: string | null) => void;
  onOpen: (item: PlanItem) => void;
}

const DRAG_TYPE = 'application/x-plan-item';

export function Kanban({ data, items, savingIds, onMove, onOpen }: Props) {
  const columns = useMemo(() => groupKanban(data, items), [data, items]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const iterations = useMemo(
    () => new Map((data.fields.iteration?.iterations ?? []).map((i) => [i.id, i.title])),
    [data],
  );
  const today = toDay(new Date().toISOString());

  if (!data.fields.status) {
    return <div className="empty">This board has no "{data.config.fields.status}" single-select field, so there are no Kanban columns.</div>;
  }

  const drop = (columnId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const itemId = e.dataTransfer.getData(DRAG_TYPE);
    const item = data.items.find((i) => i.itemId === itemId);
    const target = columnId === NO_STATUS ? null : columnId;
    if (item && item.statusOptionId !== target) onMove(item, target);
  };

  return (
    <div className="kanban">
      {columns.map((col) => (
        <section
          key={col.id}
          className={`column ${dragOver === col.id ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOver(col.id);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
          }}
          onDrop={(e) => drop(col.id, e)}
        >
          <header>
            <span className="swatch" style={{ background: col.color ? optionColor(col.color) : 'transparent' }} />
            <h2>{col.name}</h2>
            <span className="count">{col.items.length}</span>
          </header>
          <div className="cards">
            {col.items.map((item) => {
              const overdue = item.dueDate && item.issue.state === 'OPEN' && toDay(item.dueDate) < today;
              return (
                <article
                  key={item.itemId}
                  className={`card ${savingIds.has(item.itemId) ? 'saving' : ''} ${draggingId === item.itemId ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, item.itemId);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingId(item.itemId);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onOpen(item)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(item)}
                >
                  <IssueRef issue={item.issue} />
                  <h3>{item.issue.title}</h3>
                  {item.issue.labels.length > 0 && (
                    <div className="labels">
                      {item.issue.labels.map((l) => (
                        <LabelChip key={l.name} label={l} />
                      ))}
                    </div>
                  )}
                  <footer>
                    <Avatars logins={item.issue.assignees} />
                    <span className="chips">
                      {item.iterationId && iterations.has(item.iterationId) && (
                        <span className="chip">{iterations.get(item.iterationId)}</span>
                      )}
                      {item.dueDate && (
                        <span className={`chip ${overdue ? 'overdue' : ''}`} title={`Due ${item.dueDate}`}>
                          {formatDate(item.dueDate)}
                        </span>
                      )}
                    </span>
                  </footer>
                </article>
              );
            })}
            {col.items.length === 0 && <div className="drop-hint">Drop here</div>}
          </div>
        </section>
      ))}
    </div>
  );
}
