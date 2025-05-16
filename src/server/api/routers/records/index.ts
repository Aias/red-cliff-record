import { createTRPCRouter } from '../../init';
import { deleteRecords } from './delete';
import { embed } from './embed';
import { get } from './get';
import { list } from './list';
import { merge } from './merge';
import { getFamilyTree } from './tree';
import { upsert } from './upsert';

export const recordsRouter = createTRPCRouter({
	get,
	list,
	embed,
	upsert,
	merge,
	delete: deleteRecords,
	tree: getFamilyTree,
});
