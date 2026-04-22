import { Link } from '@tanstack/react-router';
import { Button } from '@/components/button';
import { styled } from '@/styled-system/jsx';

export function NotFound() {
  return (
    <styled.main
      css={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4' }}
    >
      <styled.section
        css={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4' }}
      >
        <styled.p css={{ color: 'secondary' }}>
          The page you are looking for does not exist.
        </styled.p>
        <styled.nav css={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' }}>
          <Button variant="solid" onClick={() => window.history.back()}>
            Go back
          </Button>
          <Button variant="soft" render={<Link to="/">Start Over</Link>} />
        </styled.nav>
      </styled.section>
    </styled.main>
  );
}
