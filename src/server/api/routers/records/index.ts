import { createTRPCRouter } from '../../init';
import { deleteRecords } from './delete';
import { bulkUpdate, upsert } from './edit';
import { embed } from './embed';
import { fetchFavicon } from './favicon';
import { get } from './get';
import { list } from './list';
import { merge } from './merge';
import { search } from './search';
import { getFamilyTree } from './tree';
import { undoMerge } from './undo-merge';

export const recordsRouter = createTRPCRouter({
  get,
  list,
  search,
  embed,
  upsert,
  bulkUpdate,
  merge,
  undoMerge,
  delete: deleteRecords,
  tree: getFamilyTree,
  fetchFavicon,
});
