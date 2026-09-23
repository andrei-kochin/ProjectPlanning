import type { GraphQLFn } from './graphql';
import { CLEAR_FIELD_MUTATION, UPDATE_FIELD_MUTATION } from './queries';
import type { ProjectData } from './types';
import type { ItemPatch } from './views';

/** Writes a local patch back to the Projects v2 board, one field mutation per changed field. */
export async function saveItemPatch(gql: GraphQLFn, data: ProjectData, itemId: string, patch: ItemPatch): Promise<void> {
  const projectId = data.board.projectId;
  const set = (fieldId: string, value: Record<string, string>) =>
    gql(UPDATE_FIELD_MUTATION, { projectId, itemId, fieldId, value });
  const clear = (fieldId: string) => gql(CLEAR_FIELD_MUTATION, { projectId, itemId, fieldId });
  const need = <T>(f: T | null, name: string): T => {
    if (!f) throw new Error(`The board has no ${name} field configured; cannot save`);
    return f;
  };

  if ('statusOptionId' in patch) {
    const f = need(data.fields.status, 'status');
    await (patch.statusOptionId ? set(f.id, { singleSelectOptionId: patch.statusOptionId }) : clear(f.id));
  }
  if ('dueDate' in patch) {
    const f = need(data.fields.dueDate, 'due date');
    await (patch.dueDate ? set(f.id, { date: patch.dueDate }) : clear(f.id));
  }
  if ('iterationId' in patch) {
    const f = need(data.fields.iteration, 'iteration');
    await (patch.iterationId ? set(f.id, { iterationId: patch.iterationId }) : clear(f.id));
  }
}
