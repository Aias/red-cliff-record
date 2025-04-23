import { createTRPCRouter } from '../init';
import { deleteRecords } from './records/delete';
import { embed } from './records/embed';
import { get } from './records/get';
import { list } from './records/list';
import { merge } from './records/merge';
import { search, similaritySearch } from './records/search';
import { upsert } from './records/upsert';

export const recordsRouter = createTRPCRouter({
	get,
	list,
	search,
	embed,
	similaritySearch,
	upsert,
	merge,
	delete: deleteRecords,
});
