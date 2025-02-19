/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as QueueRouteImport } from './routes/queue/route'
import { Route as CommitsRouteImport } from './routes/commits/route'
import { Route as IndexImport } from './routes/index'
import { Route as QueueRecordsImport } from './routes/queue/records'
import { Route as QueueIndicesImport } from './routes/queue/indices'
import { Route as HistoryDateImport } from './routes/history/$date'
import { Route as CommitsShaImport } from './routes/commits/$sha'
import { Route as QueueRecordsRecordIdImport } from './routes/queue/records.$recordId'
import { Route as QueueIndicesIndexEntryIdImport } from './routes/queue/indices.$indexEntryId'

// Create/Update Routes

const QueueRouteRoute = QueueRouteImport.update({
  id: '/queue',
  path: '/queue',
  getParentRoute: () => rootRoute,
} as any)

const CommitsRouteRoute = CommitsRouteImport.update({
  id: '/commits',
  path: '/commits',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const QueueRecordsRoute = QueueRecordsImport.update({
  id: '/records',
  path: '/records',
  getParentRoute: () => QueueRouteRoute,
} as any)

const QueueIndicesRoute = QueueIndicesImport.update({
  id: '/indices',
  path: '/indices',
  getParentRoute: () => QueueRouteRoute,
} as any)

const HistoryDateRoute = HistoryDateImport.update({
  id: '/history/$date',
  path: '/history/$date',
  getParentRoute: () => rootRoute,
} as any)

const CommitsShaRoute = CommitsShaImport.update({
  id: '/$sha',
  path: '/$sha',
  getParentRoute: () => CommitsRouteRoute,
} as any)

const QueueRecordsRecordIdRoute = QueueRecordsRecordIdImport.update({
  id: '/$recordId',
  path: '/$recordId',
  getParentRoute: () => QueueRecordsRoute,
} as any)

const QueueIndicesIndexEntryIdRoute = QueueIndicesIndexEntryIdImport.update({
  id: '/$indexEntryId',
  path: '/$indexEntryId',
  getParentRoute: () => QueueIndicesRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/commits': {
      id: '/commits'
      path: '/commits'
      fullPath: '/commits'
      preLoaderRoute: typeof CommitsRouteImport
      parentRoute: typeof rootRoute
    }
    '/queue': {
      id: '/queue'
      path: '/queue'
      fullPath: '/queue'
      preLoaderRoute: typeof QueueRouteImport
      parentRoute: typeof rootRoute
    }
    '/commits/$sha': {
      id: '/commits/$sha'
      path: '/$sha'
      fullPath: '/commits/$sha'
      preLoaderRoute: typeof CommitsShaImport
      parentRoute: typeof CommitsRouteImport
    }
    '/history/$date': {
      id: '/history/$date'
      path: '/history/$date'
      fullPath: '/history/$date'
      preLoaderRoute: typeof HistoryDateImport
      parentRoute: typeof rootRoute
    }
    '/queue/indices': {
      id: '/queue/indices'
      path: '/indices'
      fullPath: '/queue/indices'
      preLoaderRoute: typeof QueueIndicesImport
      parentRoute: typeof QueueRouteImport
    }
    '/queue/records': {
      id: '/queue/records'
      path: '/records'
      fullPath: '/queue/records'
      preLoaderRoute: typeof QueueRecordsImport
      parentRoute: typeof QueueRouteImport
    }
    '/queue/indices/$indexEntryId': {
      id: '/queue/indices/$indexEntryId'
      path: '/$indexEntryId'
      fullPath: '/queue/indices/$indexEntryId'
      preLoaderRoute: typeof QueueIndicesIndexEntryIdImport
      parentRoute: typeof QueueIndicesImport
    }
    '/queue/records/$recordId': {
      id: '/queue/records/$recordId'
      path: '/$recordId'
      fullPath: '/queue/records/$recordId'
      preLoaderRoute: typeof QueueRecordsRecordIdImport
      parentRoute: typeof QueueRecordsImport
    }
  }
}

// Create and export the route tree

interface CommitsRouteRouteChildren {
  CommitsShaRoute: typeof CommitsShaRoute
}

const CommitsRouteRouteChildren: CommitsRouteRouteChildren = {
  CommitsShaRoute: CommitsShaRoute,
}

const CommitsRouteRouteWithChildren = CommitsRouteRoute._addFileChildren(
  CommitsRouteRouteChildren,
)

interface QueueIndicesRouteChildren {
  QueueIndicesIndexEntryIdRoute: typeof QueueIndicesIndexEntryIdRoute
}

const QueueIndicesRouteChildren: QueueIndicesRouteChildren = {
  QueueIndicesIndexEntryIdRoute: QueueIndicesIndexEntryIdRoute,
}

const QueueIndicesRouteWithChildren = QueueIndicesRoute._addFileChildren(
  QueueIndicesRouteChildren,
)

interface QueueRecordsRouteChildren {
  QueueRecordsRecordIdRoute: typeof QueueRecordsRecordIdRoute
}

const QueueRecordsRouteChildren: QueueRecordsRouteChildren = {
  QueueRecordsRecordIdRoute: QueueRecordsRecordIdRoute,
}

const QueueRecordsRouteWithChildren = QueueRecordsRoute._addFileChildren(
  QueueRecordsRouteChildren,
)

interface QueueRouteRouteChildren {
  QueueIndicesRoute: typeof QueueIndicesRouteWithChildren
  QueueRecordsRoute: typeof QueueRecordsRouteWithChildren
}

const QueueRouteRouteChildren: QueueRouteRouteChildren = {
  QueueIndicesRoute: QueueIndicesRouteWithChildren,
  QueueRecordsRoute: QueueRecordsRouteWithChildren,
}

const QueueRouteRouteWithChildren = QueueRouteRoute._addFileChildren(
  QueueRouteRouteChildren,
)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/commits': typeof CommitsRouteRouteWithChildren
  '/queue': typeof QueueRouteRouteWithChildren
  '/commits/$sha': typeof CommitsShaRoute
  '/history/$date': typeof HistoryDateRoute
  '/queue/indices': typeof QueueIndicesRouteWithChildren
  '/queue/records': typeof QueueRecordsRouteWithChildren
  '/queue/indices/$indexEntryId': typeof QueueIndicesIndexEntryIdRoute
  '/queue/records/$recordId': typeof QueueRecordsRecordIdRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/commits': typeof CommitsRouteRouteWithChildren
  '/queue': typeof QueueRouteRouteWithChildren
  '/commits/$sha': typeof CommitsShaRoute
  '/history/$date': typeof HistoryDateRoute
  '/queue/indices': typeof QueueIndicesRouteWithChildren
  '/queue/records': typeof QueueRecordsRouteWithChildren
  '/queue/indices/$indexEntryId': typeof QueueIndicesIndexEntryIdRoute
  '/queue/records/$recordId': typeof QueueRecordsRecordIdRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/commits': typeof CommitsRouteRouteWithChildren
  '/queue': typeof QueueRouteRouteWithChildren
  '/commits/$sha': typeof CommitsShaRoute
  '/history/$date': typeof HistoryDateRoute
  '/queue/indices': typeof QueueIndicesRouteWithChildren
  '/queue/records': typeof QueueRecordsRouteWithChildren
  '/queue/indices/$indexEntryId': typeof QueueIndicesIndexEntryIdRoute
  '/queue/records/$recordId': typeof QueueRecordsRecordIdRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/commits'
    | '/queue'
    | '/commits/$sha'
    | '/history/$date'
    | '/queue/indices'
    | '/queue/records'
    | '/queue/indices/$indexEntryId'
    | '/queue/records/$recordId'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/commits'
    | '/queue'
    | '/commits/$sha'
    | '/history/$date'
    | '/queue/indices'
    | '/queue/records'
    | '/queue/indices/$indexEntryId'
    | '/queue/records/$recordId'
  id:
    | '__root__'
    | '/'
    | '/commits'
    | '/queue'
    | '/commits/$sha'
    | '/history/$date'
    | '/queue/indices'
    | '/queue/records'
    | '/queue/indices/$indexEntryId'
    | '/queue/records/$recordId'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  CommitsRouteRoute: typeof CommitsRouteRouteWithChildren
  QueueRouteRoute: typeof QueueRouteRouteWithChildren
  HistoryDateRoute: typeof HistoryDateRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  CommitsRouteRoute: CommitsRouteRouteWithChildren,
  QueueRouteRoute: QueueRouteRouteWithChildren,
  HistoryDateRoute: HistoryDateRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/commits",
        "/queue",
        "/history/$date"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/commits": {
      "filePath": "commits/route.tsx",
      "children": [
        "/commits/$sha"
      ]
    },
    "/queue": {
      "filePath": "queue/route.tsx",
      "children": [
        "/queue/indices",
        "/queue/records"
      ]
    },
    "/commits/$sha": {
      "filePath": "commits/$sha.tsx",
      "parent": "/commits"
    },
    "/history/$date": {
      "filePath": "history/$date.tsx"
    },
    "/queue/indices": {
      "filePath": "queue/indices.tsx",
      "parent": "/queue",
      "children": [
        "/queue/indices/$indexEntryId"
      ]
    },
    "/queue/records": {
      "filePath": "queue/records.tsx",
      "parent": "/queue",
      "children": [
        "/queue/records/$recordId"
      ]
    },
    "/queue/indices/$indexEntryId": {
      "filePath": "queue/indices.$indexEntryId.tsx",
      "parent": "/queue/indices"
    },
    "/queue/records/$recordId": {
      "filePath": "queue/records.$recordId.tsx",
      "parent": "/queue/records"
    }
  }
}
ROUTE_MANIFEST_END */
