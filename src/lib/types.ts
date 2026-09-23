export type OwnerType = 'user' | 'organization';

export interface ProjectConfig {
  id: string;
  name: string;
  repos: string[];
  board: { owner: string; ownerType: OwnerType; number: number };
  fields: { status: string; dueDate: string; iteration: string };
  autoAddIssues: boolean;
}

export interface StatusOption {
  id: string;
  name: string;
  color: string;
}

export interface Iteration {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** days */
  duration: number;
  completed: boolean;
}

export interface ProjectFields {
  status: { id: string; name: string; options: StatusOption[] } | null;
  dueDate: { id: string; name: string } | null;
  iteration: { id: string; name: string; iterations: Iteration[] } | null;
}

export interface Label {
  name: string;
  color: string;
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  repo: string;
  assignees: string[];
  labels: Label[];
  createdAt: string;
  closedAt: string | null;
}

export interface PlanItem {
  /** Projects v2 item node id (the target of field mutations). */
  itemId: string;
  issue: Issue;
  statusOptionId: string | null;
  /** YYYY-MM-DD */
  dueDate: string | null;
  iterationId: string | null;
  /** ISO timestamp of the first "assigned" timeline event. */
  firstAssignedAt: string | null;
}

export interface ProjectData {
  id: string;
  name: string;
  generatedAt: string;
  /** True when the data comes from bundled fixtures instead of a live sync. */
  fixture: boolean;
  /** The projects.yml entry this data was synced from (lets the browser re-fetch live data). */
  config: ProjectConfig;
  repos: string[];
  board: {
    projectId: string;
    owner: string;
    ownerType: OwnerType;
    number: number;
    title: string;
    url: string;
  };
  fields: ProjectFields;
  items: PlanItem[];
  warnings: string[];
}

export interface ProjectIndexEntry {
  id: string;
  name: string;
  repos: string[];
  generatedAt: string | null;
  fixture: boolean;
  error: string | null;
}

export interface ProjectIndex {
  generatedAt: string;
  projects: ProjectIndexEntry[];
}
