import { createTRPCRouter } from '../init';
import { deleteRecords } from './records/delete';
import { embed } from './records/embed';
import { get } from './records/get';
import { list } from './records/list';
import { merge } from './records/merge';
import { byRecordId, byTextQuery, similarityByQuery } from './records/search';
import { upsert } from './records/upsert';

export const recordsRouter = createTRPCRouter({
	get,
	list,
	embed,
	upsert,
	merge,
	delete: deleteRecords,
	searchByTextQuery: byTextQuery,
	searchByVector: similarityByQuery,
	searchByRecordId: byRecordId,
});
