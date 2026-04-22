import type { ErrorComponentProps } from '@tanstack/react-router';
import { ErrorComponent, Link, rootRouteId, useMatch, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/button';
import { styled } from '@/styled-system/jsx';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  console.error('DefaultCatchBoundary Error:', error);

  return (
    <styled.div
      css={{
        display: 'flex',
        maxWidth: '128',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4',
        padding: '4',
      }}
    >
      <ErrorComponent error={error} />
      <styled.div css={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' }}>
        <Button variant="solid" onClick={() => void router.invalidate()}>
          Try Again
        </Button>
        {isRoot ? (
          <Button render={<Link to="/">Home</Link>} />
        ) : (
          <Button
            variant="solid"
            onClick={(e) => {
              e.preventDefault();
              window.history.back();
            }}
            render={<Link to="/">Go Back</Link>}
          />
        )}
      </styled.div>
    </styled.div>
  );
}
