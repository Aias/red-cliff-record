/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as OmitListImport } from './routes/omit-list'
import { Route as CommitsImport } from './routes/commits'
import { Route as IndexImport } from './routes/index'
import { Route as HistoryDateImport } from './routes/history.$date'
import { Route as CommitsShaImport } from './routes/commits_.$sha'

// Create/Update Routes

const OmitListRoute = OmitListImport.update({
  id: '/omit-list',
  path: '/omit-list',
  getParentRoute: () => rootRoute,
} as any)

const CommitsRoute = CommitsImport.update({
  id: '/commits',
  path: '/commits',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const HistoryDateRoute = HistoryDateImport.update({
  id: '/history/$date',
  path: '/history/$date',
  getParentRoute: () => rootRoute,
} as any)

const CommitsShaRoute = CommitsShaImport.update({
  id: '/commits_/$sha',
  path: '/commits/$sha',
  getParentRoute: () => rootRoute,
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
      preLoaderRoute: typeof CommitsImport
      parentRoute: typeof rootRoute
    }
    '/omit-list': {
      id: '/omit-list'
      path: '/omit-list'
      fullPath: '/omit-list'
      preLoaderRoute: typeof OmitListImport
      parentRoute: typeof rootRoute
    }
    '/commits_/$sha': {
      id: '/commits_/$sha'
      path: '/commits/$sha'
      fullPath: '/commits/$sha'
      preLoaderRoute: typeof CommitsShaImport
      parentRoute: typeof rootRoute
    }
    '/history/$date': {
      id: '/history/$date'
      path: '/history/$date'
      fullPath: '/history/$date'
      preLoaderRoute: typeof HistoryDateImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/commits': typeof CommitsRoute
  '/omit-list': typeof OmitListRoute
  '/commits/$sha': typeof CommitsShaRoute
  '/history/$date': typeof HistoryDateRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/commits': typeof CommitsRoute
  '/omit-list': typeof OmitListRoute
  '/commits/$sha': typeof CommitsShaRoute
  '/history/$date': typeof HistoryDateRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/commits': typeof CommitsRoute
  '/omit-list': typeof OmitListRoute
  '/commits_/$sha': typeof CommitsShaRoute
  '/history/$date': typeof HistoryDateRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/commits'
    | '/omit-list'
    | '/commits/$sha'
    | '/history/$date'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/commits' | '/omit-list' | '/commits/$sha' | '/history/$date'
  id:
    | '__root__'
    | '/'
    | '/commits'
    | '/omit-list'
    | '/commits_/$sha'
    | '/history/$date'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  CommitsRoute: typeof CommitsRoute
  OmitListRoute: typeof OmitListRoute
  CommitsShaRoute: typeof CommitsShaRoute
  HistoryDateRoute: typeof HistoryDateRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  CommitsRoute: CommitsRoute,
  OmitListRoute: OmitListRoute,
  CommitsShaRoute: CommitsShaRoute,
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
        "/omit-list",
        "/commits_/$sha",
        "/history/$date"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/commits": {
      "filePath": "commits.tsx"
    },
    "/omit-list": {
      "filePath": "omit-list.tsx"
    },
    "/commits_/$sha": {
      "filePath": "commits_.$sha.tsx"
    },
    "/history/$date": {
      "filePath": "history.$date.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
