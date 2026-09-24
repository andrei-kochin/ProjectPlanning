import { useMemo } from 'react';
import type { PlanItem } from '../lib/types';
import { NO_ASSIGNEE, uniqueAssignees, uniqueLabels, type ItemFilter } from '../lib/views';

interface Props {
  items: PlanItem[];
  filter: ItemFilter;
  count: number;
  onChange: (f: ItemFilter) => void;
}

export function FilterBar({ items, filter, count, onChange }: Props) {
  const assignees = useMemo(() => uniqueAssignees(items), [items]);
  const labels = useMemo(() => uniqueLabels(items), [items]);
  const set = (patch: Partial<ItemFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="filters">
      <input
        type="search"
        aria-label="Filter by title or issue number"
        placeholder="Filter by title or #number"
        value={filter.text ?? ''}
        onChange={(e) => set({ text: e.target.value })}
      />
      <select aria-label="Filter by assignee" value={filter.assignee ?? ''} onChange={(e) => set({ assignee: e.target.value || undefined })}>
        <option value="">All assignees</option>
        <option value={NO_ASSIGNEE}>Unassigned</option>
        {assignees.map((a) => (
          <option key={a} value={a}>
            @{a}
          </option>
        ))}
      </select>
      <select aria-label="Filter by label" value={filter.label ?? ''} onChange={(e) => set({ label: e.target.value || undefined })}>
        <option value="">All labels</option>
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={!!filter.showClosed} onChange={(e) => set({ showClosed: e.target.checked })} />
        Show closed
      </label>
      <span className="count">{count} issues</span>
    </div>
  );
}
