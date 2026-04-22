import { Link, useNavigate } from '@tanstack/react-router';
import { RectangleEllipsisIcon, ShoppingBasketIcon } from 'lucide-react';
import { memo } from 'react';
import { Avatar } from '@/components/avatar';
import { Markdown } from '@/components/markdown';
import MediaGrid from '@/components/media-grid';
import { Spinner } from '@/components/spinner';
import { getRecordTitleFallbacks, useRecord } from '@/lib/hooks/record-queries';
import { useInBasket } from '@/lib/hooks/use-basket';
import type { DbId } from '@/shared/types/api';
import { sva } from '@/styled-system/css';
import { createStyleContext } from '@/styled-system/jsx';
import { getRecordTitle, SourceLogos } from './record-parts';
import { recordTypeIcons } from './type-icons';

const recordDisplay = sva({
  slots: [
    'root',
    'errorState',
    'loadingState',
    'header',
    'typeIcon',
    'titleGroup',
    'title',
    'abbreviation',
    'sense',
    'basketIcon',
    'sources',
    'mediaFigure',
    'mediaCaption',
    'summary',
    'content',
    'notes',
  ],
  base: {
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: '[0.5lh]',
      cursor: 'pointer',
      textStyle: 'sm',
    },
    errorState: {
      display: 'flex',
      alignItems: 'center',
      gap: '2',
      paddingBlock: '4',
      color: 'muted',
      fontStyle: 'italic',
      _childIcon: { boxSize: '4' },
    },
    loadingState: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBlock: '6',
    },
    header: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2' },
    typeIcon: { boxSize: 'lh', flexShrink: '0', color: 'muted' },
    titleGroup: {
      display: 'flex',
      flex: '1',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      gap: '2',
      textWrap: '[pretty]',
    },
    title: {
      fontWeight: 'semibold',
      color: 'primary',
      textDecoration: 'none',
      transitionProperty: 'colors',
      transitionDuration: '100',
      transitionTimingFunction: 'easeInOut.cubic',
      '[data-scope="recordDisplay"]:hover &': { color: 'accent' },
      '&[data-has-title="false"]': { fontWeight: 'medium', color: 'muted' },
    },
    abbreviation: { textStyle: 'xs', color: 'muted' },
    sense: { textStyle: 'xs', color: 'muted', fontStyle: 'italic' },
    basketIcon: { color: 'accent' },
    sources: { fontSize: '[0.875em]', opacity: '50%' },
    mediaFigure: { display: 'flex', flexDirection: 'column', gap: '1.5' },
    mediaCaption: { textStyle: 'xs', color: 'secondary' },
    summary: { color: 'display' },
    content: { color: 'primary' },
    notes: { fontFamily: 'mono', textStyle: 'xs', color: 'secondary' },
  },
  variants: {
    compact: {
      true: {
        summary: { lineClamp: '3' },
        content: { lineClamp: '6' },
        notes: { lineClamp: '3' },
      },
    },
  },
});

const { withProvider, withContext } = createStyleContext(recordDisplay);

const Root = withProvider('article', 'root');
const ErrorState = withProvider('div', 'errorState');
const LoadingState = withProvider('div', 'loadingState');
const Header = withContext('header', 'header');
const TitleGroup = withContext('div', 'titleGroup');
const Abbreviation = withContext('span', 'abbreviation');
const Sense = withContext('em', 'sense');
const BasketIcon = withContext(ShoppingBasketIcon, 'basketIcon');
const Sources = withContext(SourceLogos, 'sources');
const MediaFigure = withContext('figure', 'mediaFigure');
const MediaCaption = withContext(Markdown, 'mediaCaption');
const Summary = withContext(Markdown, 'summary');
const Content = withContext(Markdown, 'content');
const Notes = withContext(Markdown, 'notes');

interface RecordDisplayProps {
  recordId: DbId;
  compact?: boolean;
  className?: string;
}

export const RecordDisplay = memo(function RecordDisplay({
  recordId,
  compact,
  className,
}: RecordDisplayProps) {
  const { data: record, isError } = useRecord(recordId);
  const inBasket = useInBasket(recordId);
  const navigate = useNavigate();

  if (!record) {
    return isError ? (
      <ErrorState className={className}>
        <RectangleEllipsisIcon />
        <span>Record not found (ID: {recordId})</span>
      </ErrorState>
    ) : (
      <LoadingState className={className}>
        <Spinner />
      </LoadingState>
    );
  }

  const {
    id,
    type,
    abbreviation,
    sense,
    avatarUrl,
    title,
    summary,
    content,
    notes,
    mediaCaption,
    sources,
    media,
  } = record;
  const { creatorTitle } = getRecordTitleFallbacks(record.outgoingLinks);
  const TypeIcon = recordTypeIcons[type].icon;
  const recordMedia = media ?? [];
  const slotClasses = recordDisplay({ compact });

  return (
    <Root
      compact={compact}
      className={className}
      onClick={() => {
        void navigate({ to: '/records/$recordId', params: { recordId: id } });
      }}
    >
      <Header>
        <TypeIcon className={slotClasses.typeIcon} />
        <TitleGroup>
          <Link
            to="/records/$recordId"
            params={{ recordId: id }}
            onClick={(e) => e.stopPropagation()}
            data-has-title={Boolean(title ?? creatorTitle)}
            className={slotClasses.title}
          >
            {getRecordTitle(record)}
          </Link>
          {abbreviation && <Abbreviation>({abbreviation})</Abbreviation>}
          {sense && <Sense>{sense}</Sense>}
        </TitleGroup>
        {inBasket && <BasketIcon />}
        <Sources sources={sources} />
        {avatarUrl && <Avatar src={avatarUrl} fallback={title?.charAt(0) ?? type.charAt(0)} />}
      </Header>

      {recordMedia.length > 0 && (
        <MediaFigure>
          <MediaGrid media={recordMedia} />
          {mediaCaption && <MediaCaption as="figcaption">{mediaCaption}</MediaCaption>}
        </MediaFigure>
      )}

      {summary && <Summary>{summary}</Summary>}
      {content && <Content>{content}</Content>}
      {notes && <Notes>{notes}</Notes>}
    </Root>
  );
});
