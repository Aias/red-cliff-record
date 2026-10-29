import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { MediaTypeSchema } from '@hozo';
import { TRPCError } from '@trpc/server';
import { Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import { lookup } from 'mime-types';
import { z } from 'zod';
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

const caller = createCLICaller();

const MediaUpdateSchema = z.object({
  altText: z.string().nullable().optional(),
});

const get = Command.make(
  'get',
  {
    ids: idsArgument,
    withRecord: Flag.Boolean('with-record').pipe(
      Flag.withDescription('Include the parent record'),
      Flag.withDefault(false)
    ),
  },
  ({ ids, withRecord }) =>
    respond(async () => {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            return await caller.media.get({ id, includeRecord: withRecord });
          } catch (e) {
            if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
              return { id, error: 'NOT_FOUND' };
            }
            throw e;
          }
        })
      );
      const [first] = results;
      const single = results.length === 1 ? first : undefined;
      if (single && 'error' in single) {
        throw createError('NOT_FOUND', `Media ${single.id} not found`);
      }
      return success(single ?? results, single ? undefined : { count: results.length });
    })
).pipe(
  Command.withDescription('Get media items by ID'),
  Command.withExamples([{ command: 'rcr media get 12 34 --with-record' }])
);

const list = Command.make(
  'list',
  {
    type: Flag.Literals('type', MediaTypeSchema.options).pipe(
      Flag.withDescription('Only media of this type'),
      Flag.optional
    ),
    altText: filterFlag(
      'alt-text',
      'Only media with (--alt-text) or without (--no-alt-text) alt text'
    ),
    record: positiveIntFlag('record').pipe(
      Flag.withDescription('Only media attached to this record ID'),
      Flag.optional
    ),
    order: Flag.Literals('order', ['recordCreatedAt', 'recordUpdatedAt', 'id']).pipe(
      Flag.withDescription('Sort field; defaults to recordCreatedAt'),
      Flag.optional
    ),
    direction: Flag.Literals('direction', ['asc', 'desc']).pipe(
      Flag.withDescription('Sort direction when --order is given'),
      Flag.withDefault('desc')
    ),
    limit: limitFlag(50),
    offset: offsetFlag,
  },
  ({ type, altText, record, order, direction, limit, offset }) =>
    respond(async () => {
      const results = await caller.media.list({
        type: Option.getOrUndefined(type),
        hasAltText: Option.getOrUndefined(altText),
        recordId: Option.getOrUndefined(record),
        limit,
        offset,
        orderBy: Option.isSome(order) ? [{ field: order.value, direction }] : undefined,
      });
      return success(results, { count: results.length, limit, offset });
    })
).pipe(
  Command.withDescription('List media with filters'),
  Command.withExamples([
    { command: 'rcr media list --type image --no-alt-text --limit 10' },
    { command: 'rcr media list --record 123 --order id --direction asc' },
  ])
);

const update = Command.make('update', { id: idArgument(), data: dataFlag }, ({ id, data }) =>
  respond(async () =>
    success(await caller.media.update({ id, ...(await parseData(MediaUpdateSchema, data)) }))
  )
).pipe(
  Command.withDescription('Update media metadata'),
  Command.withExamples([
    { command: `rcr media update 123 --data '{"altText":"A photo of a sunset"}'` },
  ])
);

const create = Command.make(
  'create',
  {
    record: idArgument('record-id').pipe(Argument.withDescription('Record to attach to')),
    file: Flag.File('file').pipe(Flag.withDescription('Local file to upload'), Flag.optional),
    url: Flag.String('url').pipe(Flag.withDescription('Remote URL to upload'), Flag.optional),
    name: Flag.String('name').pipe(
      Flag.withDescription('File name; defaults to the name of --file'),
      Flag.optional
    ),
    type: Flag.String('type').pipe(
      Flag.withDescription('MIME type; detected from the file name by default'),
      Flag.optional
    ),
  },
  ({ record, file, url, name, type }) =>
    respond(async (signal) => {
      const path = Option.getOrUndefined(file);
      const remoteUrl = Option.getOrUndefined(url);
      if (path !== undefined && remoteUrl !== undefined) {
        throw createError('VALIDATION_ERROR', 'Use either --file or --url, not both.');
      }
      if (remoteUrl !== undefined) {
        return success(await caller.media.create({ recordId: record, url: remoteUrl }));
      }
      if (path === undefined) throw createError('VALIDATION_ERROR', 'Missing --file or --url.');
      const fileName = Option.getOrElse(name, () => basename(path));
      const fileType = Option.getOrElse(type, () => lookup(fileName) || '');
      if (!fileType) {
        throw createError('VALIDATION_ERROR', 'Unable to determine file type; provide --type.');
      }
      const fileData = await readFile(path, { signal });
      return success(
        await caller.media.create({
          recordId: record,
          fileData: fileData.toString('base64'),
          fileName,
          fileType,
        })
      );
    })
).pipe(
  Command.withDescription('Attach media to a record from a file or URL'),
  Command.withExamples([
    { command: 'rcr media create 123 --file ./photo.jpg' },
    { command: 'rcr media create 123 --url https://example.com/photo.jpg' },
  ])
);

const generateAlt = Command.make(
  'generate-alt',
  {
    ids: idsArgument,
    force: Flag.Boolean('force').pipe(
      Flag.withDescription('Regenerate alt text that already exists'),
      Flag.withDefault(false)
    ),
  },
  ({ ids, force }) =>
    respond(async () => {
      const results = await caller.media.generateAltText({ ids: [...ids], force });
      const data = results.map((r) => ({
        mediaId: r.mediaId,
        recordId: r.recordId ?? null,
        recordTitle: r.recordTitle ?? null,
        success: r.success,
        skipped: r.skipped ?? false,
        altText: r.altText ?? null,
        error: r.error ?? null,
      }));
      const summary = {
        total: results.length,
        generated: results.filter((r) => r.success && !r.skipped).length,
        skipped: results.filter((r) => r.skipped).length,
        failed: results.filter((r) => !r.success).length,
      };
      return success(data, summary);
    })
).pipe(
  Command.withDescription('Generate alt text for media items with OpenAI vision'),
  Command.withExamples([{ command: 'rcr media generate-alt 123 456 --force' }])
);

export const media = Command.make('media').pipe(
  Command.withDescription('Manage media attached to records'),
  Command.withSubcommands([get, list, update, create, generateAlt])
);
