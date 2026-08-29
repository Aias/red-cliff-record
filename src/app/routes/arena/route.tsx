import { RecordTypeSchema } from '@hozo/schema/records.shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CoercedIdSchema } from '@/shared/types/api';
import { styled } from '@/styled-system/jsx';
import { ArenaControls } from './-components/arena-controls';
import { arenaSessionKey, ArenaSession } from './-components/arena-session';

export const Route = createFileRoute('/arena')({
  component: ArenaPage,
  validateSearch: z.object({
    type: RecordTypeSchema.catch('artifact'),
    focus: CoercedIdSchema.optional().catch(undefined),
    side: z.enum(['left', 'right']).optional().catch(undefined),
    minScore: z.coerce.number().int().positive().optional().catch(undefined),
  }),
});

function ArenaPage() {
  const { type, focus, side, minScore } = Route.useSearch();

  return (
    <styled.main
      css={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6',
        flexBasis: 'full',
        minHeight: '0',
        overflowY: 'auto',
        padding: '6',
      }}
    >
      <ArenaControls type={type} focus={focus} minScore={minScore} />
      <ArenaSession
        key={arenaSessionKey({ type, focus, side, minScore })}
        type={type}
        focus={focus}
        side={side}
        minScore={minScore}
      />
    </styled.main>
  );
}
