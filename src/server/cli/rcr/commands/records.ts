import { IntegrationTypeSchema, RecordTypeSchema } from '@hozo';
import { TRPCError } from '@trpc/server';
import { Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import {
  BulkUpdateDataSchema,
  DEFAULT_LIMIT,
  OrderCriteriaSchema,
  RecordUpsertSchema,
} from '@/shared/types/api';
import {
  dataFlag,
  filterFlag,
  idArgument,
  idsArgument,
  limitFlag,
  offsetFlag,
  parseData,
  positiveIntFlag,
} from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { respond, success } from '../lib/output';
import type { SuccessResult } from '../lib/types';

const caller = createCLICaller();

const orNotFound = async <T>(
  id: number,
  work: Promise<T>
): Promise<T | { id: number; error: 'NOT_FOUND' }> => {
  try {
    return await work;
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') return { id, error: 'NOT_FOUND' };
    throw e;
  }
};

const settle = <T extends { id: number } | { id: number; error: string }>(
  ids: readonly number[],
  results: T[]
): SuccessResult<T | T[]> => {
  const [result] = results;
  if (ids.length > 1 || !result) return success(results, { count: results.length });
  if ('error' in result) {
    throw result.error === 'NOT_FOUND'
      ? createError('NOT_FOUND', `Record ${result.id} not found`)
      : createError('EMBEDDING_ERROR', result.error);
  }
  return success(result);
};

const recordIds = idsArgument.pipe(Argument.withDescription('Record IDs'));
const recordId = idArgument().pipe(Argument.withDescription('Record ID'));

const orderFlag = Flag.String('order').pipe(
  Flag.filterMap(
    (value) => {
      const [field, direction] = value.split(':');
      const parsed = OrderCriteriaSchema.safeParse({ field, direction });
      return parsed.success ? Option.some(parsed.data) : Option.none();
    },
    (value) => `Invalid order '${value}'; expected <field>[:asc|:desc]`
  ),
  Flag.withDescription(
    `Sort criterion as <field>[:asc|:desc] (default direction desc); repeatable. Fields: ${OrderCriteriaSchema.shape.field.options.join(', ')}`
  ),
  Flag.atLeast(0)
);

const get = Command.make(
  'get',
  {
    ids: recordIds,
    links: Flag.Boolean('links').pipe(
      Flag.withDescription('Include incoming and outgoing links'),
      Flag.withDefault(false)
    ),
  },
  ({ ids, links }) =>
    respond(async () => {
      const [found, linksMap] = await Promise.all([
        Promise.all(ids.map((id) => orNotFound(id, caller.records.get({ id })))),
        links ? caller.links.map({ recordIds: [...ids] }) : undefined,
      ]);
      return settle(
        ids,
        found.map((record) => {
          if ('error' in record || !linksMap) return record;
          const recordLinks = linksMap[record.id];
          return {
            ...record,
            incomingLinks: recordLinks?.incomingLinks ?? [],
            allOutgoingLinks: recordLinks?.outgoingLinks ?? [],
          };
        })
      );
    })
).pipe(
  Command.withDescription('Get records by ID'),
  Command.withExamples([{ command: 'rcr records get 123 456 --links' }])
);

const list = Command.make(
  'list',
  {
    types: Flag.Literals('type', RecordTypeSchema.options).pipe(
      Flag.withDescription('Only records of this type; repeatable'),
      Flag.atLeast(0)
    ),
    sources: Flag.Literals('source', IntegrationTypeSchema.options).pipe(
      Flag.withDescription('Only records from this integration source; repeatable'),
      Flag.atLeast(0)
    ),
    curated: filterFlag('curated', 'Filter by curated status (--curated or --no-curated)'),
    private: filterFlag('private', 'Filter by private status (--private or --no-private)'),
    embedding: filterFlag(
      'embedding',
      'Filter by having an embedding (--embedding or --no-embedding)'
    ),
    media: filterFlag('media', 'Filter by having media (--media or --no-media)'),
    parent: filterFlag('parent', 'Filter by having a parent (--parent or --no-parent)'),
    hasTitle: filterFlag('has-title', 'Filter by having a title (--has-title or --no-has-title)'),
    eloMin: Flag.Int('elo-min').pipe(Flag.withDescription('Minimum ELO score'), Flag.optional),
    eloMax: Flag.Int('elo-max').pipe(Flag.withDescription('Maximum ELO score'), Flag.optional),
    format: positiveIntFlag('format').pipe(
      Flag.withDescription('Only records with this record format ID'),
      Flag.optional
    ),
    order: orderFlag,
    full: Flag.Boolean('full').pipe(
      Flag.withDescription('Return full records instead of IDs'),
      Flag.withDefault(false)
    ),
    limit: limitFlag(DEFAULT_LIMIT),
    offset: offsetFlag,
  },
  (flags) =>
    respond(async () => {
      const { limit, offset } = flags;
      const { ids } = await caller.records.list({
        filters: {
          types: flags.types.length ? [...flags.types] : undefined,
          sources: flags.sources.length ? [...flags.sources] : undefined,
          isCurated: Option.getOrUndefined(flags.curated),
          isPrivate: Option.getOrUndefined(flags.private),
          hasEmbedding: Option.getOrUndefined(flags.embedding),
          hasMedia: Option.getOrUndefined(flags.media),
          hasParent: Option.getOrUndefined(flags.parent),
          hasTitle: Option.getOrUndefined(flags.hasTitle),
          minElo: Option.getOrUndefined(flags.eloMin),
          maxElo: Option.getOrUndefined(flags.eloMax),
          formatId: Option.getOrUndefined(flags.format),
        },
        limit,
        offset,
        orderBy: flags.order.length
          ? [...flags.order]
          : [{ field: 'recordCreatedAt', direction: 'desc' }],
      });
      const results = flags.full
        ? await Promise.all(ids.map(({ id }) => orNotFound(id, caller.records.get({ id }))))
        : ids;
      return success(results, { count: results.length, limit, offset });
    })
).pipe(
  Command.withDescription('List records matching filters'),
  Command.withExamples([
    {
      command:
        'rcr records list --type entity --type concept --no-curated --order eloScore:desc --order title:asc --limit 20',
    },
  ])
);

const create = Command.make('create', { data: dataFlag }, ({ data }) =>
  respond(async () =>
    success(await caller.records.upsert(await parseData(RecordUpsertSchema, data)))
  )
).pipe(
  Command.withDescription('Create a record'),
  Command.withExamples([
    { command: `rcr records create --data '{"type":"concept","title":"Example"}'` },
  ])
);

const update = Command.make('update', { id: recordId, data: dataFlag }, ({ id, data }) =>
  respond(async () =>
    success(await caller.records.upsert({ ...(await parseData(RecordUpsertSchema, data)), id }))
  )
).pipe(
  Command.withDescription('Update a record'),
  Command.withExamples([{ command: `rcr records update 123 --data '{"title":"New title"}'` }])
);

const bulkUpdate = Command.make(
  'bulk-update',
  { ids: recordIds, data: dataFlag },
  ({ ids, data }) =>
    respond(async () => {
      const updatedIds = await caller.records.bulkUpdate({
        ids: [...ids],
        data: await parseData(BulkUpdateDataSchema, data),
      });
      return success(updatedIds, { count: updatedIds.length });
    })
).pipe(
  Command.withDescription('Apply the same changes to several records'),
  Command.withExamples([{ command: `rcr records bulk-update 1 2 3 --data '{"isCurated":true}'` }])
);

const del = Command.make('delete', { ids: recordIds }, ({ ids }) =>
  respond(async () => {
    const result = await caller.records.delete([...ids]);
    return success(result, { count: result.length });
  })
).pipe(Command.withDescription('Delete records by ID'));

const merge = Command.make(
  'merge',
  {
    sourceId: idArgument('source-id').pipe(
      Argument.withDescription('Record merged into the target, then removed')
    ),
    targetId: idArgument('target-id').pipe(
      Argument.withDescription('Record that receives the source record')
    ),
  },
  ({ sourceId, targetId }) =>
    respond(async () => {
      if (sourceId === targetId) {
        throw createError('VALIDATION_ERROR', 'Source and target cannot be the same record');
      }
      return success(await caller.records.merge({ sourceId, targetId }));
    })
).pipe(
  Command.withDescription('Merge a source record into a target record'),
  Command.withExamples([{ command: 'rcr records merge 123 456' }])
);

const refitElo = Command.make('refit-elo', {}, () =>
  respond(async () => success(await caller.records.refitElo()))
).pipe(Command.withDescription('Refit all ELO scores from stored matchup history'));

const embed = Command.make('embed', { ids: recordIds }, ({ ids }) =>
  respond(async () => {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          return await caller.records.embed({ id });
        } catch (e) {
          if (!(e instanceof TRPCError)) throw e;
          return { id, error: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : e.message };
        }
      })
    );
    return settle(ids, results);
  })
).pipe(Command.withDescription('Generate embeddings for records'));

const summarize = Command.make('summarize', { ids: recordIds }, ({ ids }) =>
  respond(async () => {
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const summary = await caller.records.summarize({ id });
          await caller.records.upsert({ id, summary });
          await caller.records.embed({ id });
          return { id, summary };
        } catch (e) {
          if (e instanceof TRPCError) return { id, error: e.message };
          throw e;
        }
      })
    );
    return success(results, { count: results.length });
  })
).pipe(
  Command.withDescription(
    'Regenerate the summary of Readwise document records and refresh their embeddings'
  )
);

const tree = Command.make('tree', { ids: recordIds }, ({ ids }) =>
  respond(async () =>
    settle(ids, await Promise.all(ids.map((id) => orNotFound(id, caller.records.tree({ id })))))
  )
).pipe(Command.withDescription('Get the hierarchical family tree of records'));

const children = Command.make('children', { id: recordId }, ({ id }) =>
  respond(async () => {
    const { incomingLinks } = await caller.records.tree({ id });
    const childRecords = incomingLinks.map((link) => ({
      id: link.source.id,
      title: link.source.title,
      recordCreatedAt: link.source.recordCreatedAt,
      predicate: link.predicate,
    }));
    return success({ parentId: id, children: childRecords }, { count: childRecords.length });
  })
).pipe(Command.withDescription('List the children of a record (sources of contained_by links)'));

const parent = Command.make('parent', { id: recordId }, ({ id }) =>
  respond(async () => {
    const [link] = (await caller.records.tree({ id })).outgoingLinks;
    return success({
      childId: id,
      parent: link
        ? {
            id: link.target.id,
            title: link.target.title,
            recordCreatedAt: link.target.recordCreatedAt,
            predicate: link.predicate,
          }
        : null,
    });
  })
).pipe(Command.withDescription('Get the parent of a record (target of its contained_by link)'));

export const records = Command.make('records').pipe(
  Command.withDescription('Manage records'),
  Command.withSubcommands([
    get,
    list,
    create,
    update,
    bulkUpdate,
    del,
    merge,
    refitElo,
    embed,
    summarize,
    tree,
    children,
    parent,
  ]),
  Command.withAlias('record')
);
