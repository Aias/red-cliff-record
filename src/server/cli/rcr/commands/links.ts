import { LinkInsertSchema, PREDICATES, predicateSlugs } from '@hozo';
import { Option } from 'effect';
import { Command, Flag } from 'effect/cli';
import { dataFlag, idArgument, idsArgument, parseData } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { respond, success } from '../lib/output';

const caller = createCLICaller();

const list = Command.make(
  'list',
  {
    id: idArgument(),
    predicate: Flag.Literals('predicate', predicateSlugs).pipe(
      Flag.withDescription('Only links with this predicate'),
      Flag.optional
    ),
    direction: Flag.Literals('direction', ['incoming', 'outgoing']).pipe(
      Flag.withDescription('Only links in this direction'),
      Flag.optional
    ),
  },
  ({ id, predicate, direction }) =>
    respond(async () => {
      const result = await caller.links.listForRecord({ id });
      const matches = <T extends { predicate: string }>(links: T[]) =>
        Option.isSome(predicate)
          ? links.filter((link) => link.predicate === predicate.value)
          : links;
      const outgoingLinks =
        Option.getOrUndefined(direction) === 'incoming' ? [] : matches(result.outgoingLinks);
      const incomingLinks =
        Option.getOrUndefined(direction) === 'outgoing' ? [] : matches(result.incomingLinks);
      return success(
        { id: result.id, outgoingLinks, incomingLinks },
        { count: outgoingLinks.length + incomingLinks.length }
      );
    })
).pipe(Command.withDescription("List a record's links"));

const create = Command.make('create', { data: dataFlag }, ({ data }) =>
  respond(async () => success(await caller.links.upsert(await parseData(LinkInsertSchema, data))))
).pipe(
  Command.withDescription('Create or update a link'),
  Command.withExamples([
    {
      command: `rcr links create --data '{"sourceId":1,"targetId":2,"predicate":"contained_by"}'`,
    },
  ])
);

const del = Command.make('delete', { ids: idsArgument }, ({ ids }) =>
  respond(async () => {
    const result = await caller.links.delete([...ids]);
    return success(result, { count: result.length });
  })
).pipe(Command.withDescription('Delete links by ID'));

const predicates = Command.make('predicates', {}, () =>
  respond(async () => {
    const result = Object.values(PREDICATES);
    return success(result, { count: result.length });
  })
).pipe(Command.withDescription('List predicate types'));

export const links = Command.make('links').pipe(
  Command.withDescription('Manage links between records'),
  Command.withSubcommands([list, create, del, predicates])
);
