import { labelTextColor } from '../lib/colors';
import type { Issue, Label } from '../lib/types';

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className="label" style={{ background: `#${label.color}`, color: labelTextColor(label.color) }}>
      {label.name}
    </span>
  );
}

export function Avatars({ logins, size = 20 }: { logins: string[]; size?: number }) {
  if (logins.length === 0) return <span className="unassigned">Unassigned</span>;
  return (
    <span className="avatars">
      {logins.map((l) => (
        <span key={l} className="avatar" title={`@${l}`} style={{ width: size, height: size }}>
          <span className="initial">{l[0]?.toUpperCase()}</span>
          <img
            src={`https://github.com/${l}.png?size=${size * 2}`}
            alt=""
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </span>
      ))}
    </span>
  );
}

export function IssueRef({ issue }: { issue: Issue }) {
  return (
    <a className={`issue-ref ${issue.state === 'CLOSED' ? 'closed' : ''}`} href={issue.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        {issue.state === 'CLOSED' ? (
          <path fill="currentColor" d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5ZM16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z" />
        ) : (
          <path fill="currentColor" d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
        )}
      </svg>
      {issue.repo.split('/')[1]}#{issue.number}
    </a>
  );
}

export function formatDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
