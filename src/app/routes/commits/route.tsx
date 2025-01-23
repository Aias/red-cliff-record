import { useCallback } from 'react'
import { CheckCircledIcon, CircleIcon } from '@radix-ui/react-icons'
import { Button, Card, Heading, ScrollArea } from '@radix-ui/themes'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { AppLink } from '~/app/components/AppLink'
import { DataGrid } from '~/app/components/DataGrid'
import { IconWrapper } from '~/app/components/IconWrapper'
import { useSelection } from '~/app/lib/useSelection'
import { trpc } from '~/app/trpc'
import { type CommitSummaryInput } from '~/server/api/routers/github.types'
import {
  type GithubCommitChangeSelect,
  type GithubCommitSelect,
  type GithubRepositorySelect,
} from '~/server/db/schema/integrations'

type CommitSelect = GithubCommitSelect & {
  repository: GithubRepositorySelect
  commitChanges: GithubCommitChangeSelect[]
}

export const mapCommitToInput = (commit: CommitSelect): CommitSummaryInput => {
  return {
    message: commit.message,
    sha: commit.sha,
    changes: commit.changes,
    additions: commit.additions,
    deletions: commit.deletions,
    commitChanges: commit.commitChanges.map((change) => ({
      filename: change.filename,
      status: change.status,
      changes: change.changes,
      deletions: change.deletions,
      additions: change.additions,
      patch: change.patch,
    })),
    repository: {
      fullName: commit.repository.fullName,
      description: commit.repository.description,
      language: commit.repository.language,
      topics: commit.repository.topics,
      licenseName: commit.repository.licenseName,
    },
  }
}

export const Route = createFileRoute('/commits')({
  loader: async ({ context: { trpc, queryClient } }) => {
    await queryClient.ensureQueryData(trpc.github.getCommits.queryOptions())
  },
  component: CommitList,
})

const columns: ColumnDef<GithubCommitSelect>[] = [
  {
    accessorKey: 'sha',
    header: 'SHA',
    cell: ({ row }) => (
      <AppLink to={`/commits/$sha`} params={{ sha: row.original.sha }}>
        {row.original.sha.slice(0, 7)}
      </AppLink>
    ),
  },
  {
    accessorKey: 'repository.name',
    header: 'Repository',
  },
  {
    accessorKey: 'message',
    header: 'Message',
  },
  {
    accessorKey: 'committedAt',
    header: 'Date',
    cell: ({ getValue }) => {
      const date = getValue() as Date | null
      return date ? new Date(date).toLocaleDateString() : ''
    },
  },
  {
    accessorKey: 'summary',
    header: 'Summarized',
    meta: {
      columnProps: {
        align: 'center',
      },
    },
    cell: ({ getValue }) => {
      const summary = getValue()
      return summary ? (
        <IconWrapper color="grass">
          <CheckCircledIcon />
        </IconWrapper>
      ) : (
        <IconWrapper>
          <CircleIcon />
        </IconWrapper>
      )
    },
  },
]

function CommitList() {
  const [commits, commitsQuery] = trpc.github.getCommits.useSuspenseQuery()
  const trpcUtils = trpc.useUtils()
  const navigate = useNavigate()
  const { selectedIds, setSelection, clearSelection } = useSelection(
    commits.map((commit) => ({ id: commit.sha })),
  )

  const batchSummarizeCommits = trpc.github.batchSummarize.useMutation({
    onSuccess: async () => {
      await commitsQuery.refetch()
      trpcUtils.github.getCommitBySha.invalidate()
      clearSelection()
    },
  })

  const handleBatchSummarize = useCallback(() => {
    const selectedCommits = Array.from(selectedIds).map((sha) => {
      const commit = commits.find((c) => c.sha === sha)!
      return mapCommitToInput(commit)
    })

    batchSummarizeCommits.mutate(selectedCommits)
  }, [batchSummarizeCommits, selectedIds, commits])

  return (
    <main className="@container flex h-full gap-2 overflow-hidden p-3">
      <Card className="grow basis-0 @max-[799px]:hidden min-w-[max(420px,50%)]">
        <header className="mb-4 flex items-center justify-between gap-2">
          <Heading size="6">Recent Commits</Heading>
          {selectedIds.size > 0 && (
            <Button
              onClick={handleBatchSummarize}
              disabled={batchSummarizeCommits.isPending}
            >
              {batchSummarizeCommits.isPending
                ? 'Summarizing...'
                : `Summarize ${selectedIds.size} Commits`}
            </Button>
          )}
        </header>
        <ScrollArea>
          <DataGrid
            data={commits}
            columns={columns}
            sorting={true}
            selection={{
              enabled: true,
              selectedIds,
              onSelectionChange: setSelection,
            }}
            onRowClick={(commit) =>
              navigate({ to: '/commits/$sha', params: { sha: commit.sha } })
            }
            getRowId={(commit) => commit.sha}
            rootProps={{
              variant: 'ghost',
            }}
          />
        </ScrollArea>
      </Card>
      <Outlet />
    </main>
  )
}
