import { createTRPCRouter } from '../../init';
import { deleteRecords } from './delete';
import { bulkUpdate, upsert } from './edit';
import { embed } from './embed';
import { fetchFavicon } from './favicon';
import { get } from './get';
import { list } from './list';
import { merge } from './merge';
import { refitElo } from './refit-elo';
import { getFamilyTree } from './tree';
import { undoMerge } from './undo-merge';

export const recordsRouter = createTRPCRouter({
  get,
  list,
  embed,
  upsert,
  bulkUpdate,
  merge,
  refitElo,
  undoMerge,
  delete: deleteRecords,
  tree: getFamilyTree,
  fetchFavicon,
});
