import type { GraphQLFn } from './graphql';
import { CLEAR_FIELD_MUTATION, UPDATE_FIELD_MUTATION } from './queries';
import type { ProjectData } from './types';
import type { ItemPatch } from './views';

/**
 * Thrown when a multi-field save fails part-way. GitHub has no multi-field mutation, so fields
 * listed in `applied` were already written and must not be rolled back locally.
 */
export class PartialSaveError extends Error {
  constructor(
    message: string,
    public readonly applied: ItemPatch,
    public readonly failedField: keyof ItemPatch,
  ) {
    super(message);
    this.name = 'PartialSaveError';
  }
}

/** Writes a local patch back to the Projects v2 board, one field mutation per changed field. */
export async function saveItemPatch(gql: GraphQLFn, data: ProjectData, itemId: string, patch: ItemPatch): Promise<void> {
  const projectId = data.board.projectId;
  const fieldFor = {
    statusOptionId: { field: data.fields.status, name: 'status', value: (v: string) => ({ singleSelectOptionId: v }) },
    dueDate: { field: data.fields.dueDate, name: 'due date', value: (v: string) => ({ date: v }) },
    iterationId: { field: data.fields.iteration, name: 'iteration', value: (v: string) => ({ iterationId: v }) },
  } as const;

  const keys = (Object.keys(fieldFor) as (keyof ItemPatch)[]).filter((k) => k in patch);
  for (const k of keys) {
    if (!fieldFor[k].field) throw new Error(`The board has no ${fieldFor[k].name} field configured; cannot save`);
  }

  const applied: ItemPatch = {};
  for (const k of keys) {
    const { field, value } = fieldFor[k];
    const v = patch[k];
    try {
      await (v
        ? gql(UPDATE_FIELD_MUTATION, { projectId, itemId, fieldId: field!.id, value: value(v) })
        : gql(CLEAR_FIELD_MUTATION, { projectId, itemId, fieldId: field!.id }));
    } catch (e) {
      if (Object.keys(applied).length === 0) throw e;
      throw new PartialSaveError((e as Error).message, applied, k);
    }
    applied[k] = v;
  }
}
