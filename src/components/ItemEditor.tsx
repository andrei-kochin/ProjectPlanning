import { useState } from 'react';
import type { PlanItem, ProjectData } from '../lib/types';
import { iterationEnd, type ItemPatch } from '../lib/views';
import { Avatars, formatDate, IssueRef, LabelChip } from './IssueBits';
import { Modal } from './Modal';

interface Props {
  data: ProjectData;
  item: PlanItem;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: ItemPatch) => void;
}

export function ItemEditor({ data, item, saving, onClose, onSave }: Props) {
  const [status, setStatus] = useState(item.statusOptionId ?? '');
  const [due, setDue] = useState(item.dueDate ?? '');
  const [iteration, setIteration] = useState(item.iterationId ?? '');
  const { fields } = data;

  const patch: ItemPatch = {};
  if ((status || null) !== item.statusOptionId) patch.statusOptionId = status || null;
  if ((due || null) !== item.dueDate) patch.dueDate = due || null;
  if ((iteration || null) !== item.iterationId) patch.iterationId = iteration || null;
  const dirty = Object.keys(patch).length > 0;

  return (
    <Modal title={<IssueRef issue={item.issue} />} onClose={onClose}>
      <h3 className="editor-title">{item.issue.title}</h3>
      <div className="editor-meta">
        <Avatars logins={item.issue.assignees} />
        {item.issue.labels.map((l) => (
          <LabelChip key={l.name} label={l} />
        ))}
      </div>
      <p className="muted small">
        {item.firstAssignedAt
          ? `First assigned ${formatDate(item.firstAssignedAt)} ${item.firstAssignedAt.slice(0, 4)} (Gantt start).`
          : 'Never assigned: the Gantt shows only the due date.'}
      </p>

      <form
        className="editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) onSave(patch);
          else onClose();
        }}
      >
        <label>
          <span>{fields.status?.name ?? 'Status'}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!fields.status} autoFocus>
            <option value="">No status</option>
            {fields.status?.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{fields.dueDate?.name ?? 'Due date'}</span>
          <div className="row">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={!fields.dueDate} />
            {due && (
              <button type="button" className="btn ghost small" onClick={() => setDue('')}>
                Clear
              </button>
            )}
          </div>
        </label>
        <label>
          <span>{fields.iteration?.name ?? 'Iteration'}</span>
          <select value={iteration} onChange={(e) => setIteration(e.target.value)} disabled={!fields.iteration}>
            <option value="">No iteration</option>
            {fields.iteration?.iterations.map((it) => (
              <option key={it.id} value={it.id}>
                {it.title} ({formatDate(it.startDate)} – {formatDate(iterationEnd(it))}){it.completed ? ' · completed' : ''}
              </option>
            ))}
          </select>
        </label>
        <footer>
          <a href={item.issue.url} target="_blank" rel="noreferrer" className="muted">
            Open on GitHub ↗
          </a>
          <div className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!dirty || saving}>
            {data.fixture ? 'Apply (demo)' : 'Save to GitHub'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
