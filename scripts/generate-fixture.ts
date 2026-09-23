/**
 * Generates fixtures/benchmark.graphql.json: a realistic board for itikhono/benchmark in the exact
 * raw shape returned by the board query (see src/lib/queries.ts). Deterministic, so re-running it
 * produces the same file.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RawBoard, RawItem } from '../src/lib/normalize';

const REPO = 'itikhono/benchmark';
const ids = { status: 'PVTSSF_status', due: 'PVTF_due', iteration: 'PVTIF_iteration' };

const statusOptions = [
  { id: 'opt_todo', name: 'Todo', color: 'GRAY' },
  { id: 'opt_progress', name: 'In Progress', color: 'YELLOW' },
  { id: 'opt_blocked', name: 'Blocked', color: 'RED' },
  { id: 'opt_review', name: 'In Review', color: 'PURPLE' },
  { id: 'opt_done', name: 'Done', color: 'GREEN' },
];
const S = Object.fromEntries(statusOptions.map((o) => [o.name, o.id]));

const sprints = [
  { id: 'it_s1', title: 'Sprint 1', startDate: '2026-08-17', duration: 14 },
  { id: 'it_s2', title: 'Sprint 2', startDate: '2026-08-31', duration: 14 },
  { id: 'it_s3', title: 'Sprint 3', startDate: '2026-09-14', duration: 14 },
  { id: 'it_s4', title: 'Sprint 4', startDate: '2026-09-28', duration: 14 },
  { id: 'it_s5', title: 'Sprint 5', startDate: '2026-10-12', duration: 14 },
];

const LABEL_COLORS: Record<string, string> = {
  'benchmark-request': '0e8a16',
  enhancement: 'a2eeef',
  bug: 'd73a4a',
  documentation: '0075ca',
  question: 'd876e3',
  'help wanted': '008672',
};

type Row = [
  number: number,
  title: string,
  labels: string[],
  assignees: string[],
  status: string | null,
  assignedAt: string | null,
  due: string | null,
  sprint: string | null,
  closedAt?: string,
];

// PR numbers in the real repo (1, 2, 21, 22, 25, 28, 29, 31, 33) are skipped.
const rows: Row[] = [
  [3, 'Baseline vLLM ROCm throughput harness for Llama-3.1-8B', ['enhancement'], ['itikhono'], 'Done', '2026-08-18T09:12:00Z', '2026-08-28', 'it_s1', '2026-08-27T16:40:00Z'],
  [4, 'Collect rocprof traces during serving benchmark', ['enhancement'], ['sshliapn'], 'Done', '2026-08-19T11:03:00Z', '2026-08-29', 'it_s1', '2026-08-29T10:05:00Z'],
  [5, 'Result parser drops TTFT percentiles for SGLang 0.5', ['bug'], ['itikhono'], 'Done', '2026-08-24T08:30:00Z', '2026-08-30', 'it_s1', '2026-08-28T14:22:00Z'],
  [6, 'Add SGLang engine adapter to orchestrator', ['enhancement'], ['sshliapn'], 'In Review', '2026-08-31T10:00:00Z', '2026-09-18', 'it_s2'],
  [7, 'Document docker image pinning for ROCm 7.x', ['documentation'], ['andrei-kochin'], 'Todo', '2026-09-02T13:45:00Z', '2026-09-12', 'it_s2'],
  [8, 'Throughput regression on MI300X after vLLM 0.11 bump', ['bug'], ['itikhono', 'sshliapn'], 'Blocked', '2026-09-03T07:55:00Z', '2026-09-19', 'it_s2'],
  [9, 'Sweep max-num-batched-tokens for DeepSeek-V3.2', ['enhancement'], ['itikhono'], 'In Progress', '2026-09-14T09:00:00Z', '2026-09-26', 'it_s3'],
  [10, 'Add ATOM engine support (serving mode only)', ['enhancement', 'help wanted'], [], 'Todo', null, '2026-10-09', 'it_s4'],
  [11, 'Per-run environment capture (driver, firmware, image digest)', ['enhancement'], ['sshliapn'], 'In Progress', '2026-09-15T12:20:00Z', '2026-09-25', 'it_s3'],
  [12, 'GLM-5.2-FP8 flag search: attention backend x quantized KV cache', ['enhancement'], ['itikhono'], 'In Progress', '2026-09-16T08:10:00Z', '2026-10-02', 'it_s3'],
  [13, 'Orchestrator hangs when container OOMs during warmup', ['bug'], ['andrei-kochin'], 'In Review', '2026-09-17T15:30:00Z', '2026-09-24', 'it_s3'],
  [14, 'Should workloads be defined per model or per engine?', ['question'], [], null, null, null, null],
  [15, 'Nightly benchmark job on shared MI355X node', ['enhancement'], ['sshliapn'], 'Todo', '2026-09-21T10:00:00Z', '2026-10-09', 'it_s4'],
  [16, 'Export results to CSV + summary markdown', ['enhancement'], ['andrei-kochin'], 'Todo', '2026-09-22T09:40:00Z', null, 'it_s4'],
  [17, 'Speculative decoding (EAGLE-3) benchmark for Llama-4 Maverick', ['enhancement'], [], 'Todo', null, '2026-10-23', 'it_s5'],
  [18, 'Multi-node TP=16 serving benchmark', ['enhancement', 'help wanted'], [], 'Todo', null, null, 'it_s5'],
  [19, 'Compare hipBLASLt tuned GEMMs vs defaults', ['enhancement'], ['itikhono'], 'Todo', '2026-09-10T11:11:00Z', '2026-10-16', null],
  [20, 'Clarify success criteria wording in benchmark request form', ['documentation'], ['sshliapn'], 'Done', '2026-09-08T08:00:00Z', '2026-09-11', 'it_s2', '2026-09-10T17:00:00Z'],
  [23, '[Benchmark request]: Qwen3-235B-A22B FP8 on MI300X, vLLM', ['benchmark-request'], ['itikhono'], 'In Progress', '2026-09-18T09:00:00Z', '2026-09-30', 'it_s3'],
  [24, '[Benchmark request]: Mixtral 8x22B long-context (32k) SGLang', ['benchmark-request'], [], 'Todo', null, null, null],
  [26, '[Benchmark request]: gpt-oss-120b MXFP4 latency sweep', ['benchmark-request'], ['sshliapn'], 'Todo', '2026-09-22T14:00:00Z', '2026-10-07', 'it_s4'],
  [27, 'Flaky: client timeout at concurrency 256', ['bug'], ['andrei-kochin'], 'In Progress', '2026-09-20T10:30:00Z', '2026-09-18', 'it_s3'],
  [30, '[Benchmark request]: Llama-3.3-70B FP8 vs BF16 throughput, ATOM', ['benchmark-request'], [], null, null, null, null],
  [32, '[Benchmark request]: GLM-5.2-FP8 serving on MI355X, vLLM nightly', ['benchmark-request'], ['itikhono'], 'Todo', '2026-09-23T07:15:00Z', '2026-10-14', 'it_s4'],
];

const createdAt = (n: number) => new Date(Date.UTC(2026, 7, 10) + n * 18 * 3_600_000).toISOString().replace('.000', '');

function item(r: Row): RawItem {
  const [number, title, labels, assignees, status, assignedAt, due, sprint, closedAt] = r;
  const fieldValues: RawItem['fieldValues']['nodes'] = [
    { __typename: 'ProjectV2ItemFieldTextValue' },
  ];
  if (status) fieldValues.push({ __typename: 'ProjectV2ItemFieldSingleSelectValue', optionId: S[status], field: { id: ids.status } });
  if (due) fieldValues.push({ __typename: 'ProjectV2ItemFieldDateValue', date: due, field: { id: ids.due } });
  if (sprint) fieldValues.push({ __typename: 'ProjectV2ItemFieldIterationValue', iterationId: sprint, field: { id: ids.iteration } });
  return {
    id: `PVTI_benchmark_${number}`,
    type: 'ISSUE',
    isArchived: false,
    content: {
      __typename: 'Issue',
      id: `I_benchmark_${number}`,
      number,
      title,
      url: `https://github.com/${REPO}/issues/${number}`,
      state: closedAt ? 'CLOSED' : 'OPEN',
      createdAt: createdAt(number),
      closedAt: closedAt ?? null,
      repository: { nameWithOwner: REPO },
      assignees: { nodes: assignees.map((login) => ({ login })) },
      labels: { nodes: labels.map((name) => ({ name, color: LABEL_COLORS[name] ?? 'ededed' })) },
      timelineItems: { nodes: assignedAt ? [{ createdAt: assignedAt }] : [] },
    },
    fieldValues: { nodes: fieldValues },
  };
}

const board: RawBoard = {
  id: 'PVT_fixture_benchmark',
  title: 'Benchmark planning',
  url: 'https://github.com/users/andrei-kochin/projects/1',
  fields: {
    nodes: [
      { __typename: 'ProjectV2Field', id: 'PVTF_title', name: 'Title', dataType: 'TITLE' },
      { __typename: 'ProjectV2Field', id: 'PVTF_assignees', name: 'Assignees', dataType: 'ASSIGNEES' },
      { __typename: 'ProjectV2SingleSelectField', id: ids.status, name: 'Status', dataType: 'SINGLE_SELECT', options: statusOptions },
      { __typename: 'ProjectV2Field', id: 'PVTF_labels', name: 'Labels', dataType: 'LABELS' },
      { __typename: 'ProjectV2Field', id: ids.due, name: 'Due date', dataType: 'DATE' },
      {
        __typename: 'ProjectV2IterationField',
        id: ids.iteration,
        name: 'Iteration',
        dataType: 'ITERATION',
        configuration: {
          completedIterations: sprints.slice(0, 2),
          iterations: sprints.slice(2),
        },
      },
    ],
  },
  items: {
    nodes: [
      ...rows.map(item),
      // Non-issue items and issues from other repos must be ignored by the normalizer.
      {
        id: 'PVTI_draft_1',
        type: 'DRAFT_ISSUE',
        content: { __typename: 'DraftIssue' },
        fieldValues: { nodes: [] },
      },
      {
        id: 'PVTI_pr_31',
        type: 'PULL_REQUEST',
        content: { __typename: 'PullRequest' },
        fieldValues: { nodes: [] },
      },
    ],
  },
};

const out = path.resolve(import.meta.dirname, '..', 'fixtures', 'benchmark.graphql.json');
await writeFile(out, JSON.stringify(board, null, 2) + '\n');
console.log(`wrote ${path.relative(process.cwd(), out)} (${rows.length} issues)`);
