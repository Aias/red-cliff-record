import { createTRPCRouter } from '../init';
import { findDuplicates } from './records/find-duplicates';
import { get } from './records/get';
import { list } from './records/list';
import { merge } from './records/merge';
import { search } from './records/search';
import { upsert } from './records/upsert';

export const recordsRouter = createTRPCRouter({
	get,
	list,
	search,
	upsert,
	merge,
	findDuplicates,
});
