import { createTRPCRouter } from '../../init';
import { deleteRecords } from './delete';
import { bulkUpdate, upsert } from './edit';
import { embed } from './embed';
import { get } from './get';
import { list } from './list';
import { merge } from './merge';
import { getFamilyTree } from './tree';

export const recordsRouter = createTRPCRouter({
  get,
  list,
  embed,
  upsert,
  bulkUpdate,
  merge,
  delete: deleteRecords,
  tree: getFamilyTree,
});
