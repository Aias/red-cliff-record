import { lightroomImages } from '@hozo';
import { Effect } from 'effect';
import { HttpClient } from 'effect/unstable/http';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError, DbError } from '../runtime/errors';
import {
  forEachCollect,
  requireRunId,
  type IntegrationDef,
  type SyncSummary,
} from '../runtime/run';
import { decodeZod } from '../runtime/zod';
import { withLightroomApiKey } from './helpers';
import { createMediaFromLightroomImages } from './map';
import { LightroomJsonResponseSchema, type LightroomJsonResponse } from './types';

const ALBUM_URL =
  'https://lightroom.adobe.com/v2/spaces/f89a3c5060d8467a952c66de97edbe39/albums/f1edd4179e2f4e1d802f8a94f40b542c/assets?embed=asset%3Buser&order_after=-&exclude=incomplete&subtype=image';

const decodeAlbum = decodeZod(LightroomJsonResponseSchema, 'lightroom album');

const fetchAlbum = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  const response = yield* client.get(ALBUM_URL);
  const text = yield* response.text;
  // Adobe returns JSONP with a while(1){} prefix ahead of the JSON body
  const json = yield* Effect.try({
    try: (): unknown => JSON.parse(text.replace(/^while\s*\(1\)\s*{\s*}\s*/, '')),
    catch: (cause) => new ApiRequestError({ resource: 'lightroom album', cause }),
  });
  const sink = yield* DebugSink;
  yield* sink.capture(json);
  const album = yield* decodeAlbum(json);
  yield* Effect.logInfo(`Retrieved ${album.resources.length} resources from Lightroom`);
  return album;
});

const toImageInsert = (
  resource: LightroomJsonResponse['resources'][number],
  baseUrl: string,
  integrationRunId: number
) => {
  const { payload, created, updated, links, id } = resource.asset;
  const {
    importSource,
    autoTags,
    develop,
    changedOnDevice,
    xmp,
    location,
    ratings,
    aesthetics,
    captureDate,
    userUpdated,
  } = payload;
  const firstRatingKey = ratings ? Object.keys(ratings)[0] : undefined;
  const rating = firstRatingKey && ratings ? (ratings[firstRatingKey]?.rating ?? 0) : 0;
  return {
    id,
    url2048: withLightroomApiKey(`${baseUrl}${links['/rels/rendition_type/2048'].href}`),
    baseUrl,
    links,
    fileName: importSource.fileName,
    contentType: importSource.contentType,
    sourceDevice: changedOnDevice ?? importSource.importedOnDevice ?? develop.device,
    cameraMake: xmp.tiff.Make,
    cameraModel: xmp.tiff.Model,
    cameraLens: xmp.aux?.Lens,
    captureDate,
    userUpdatedDate: userUpdated,
    fileSize: importSource.fileSize,
    croppedWidth: develop.croppedWidth,
    croppedHeight: develop.croppedHeight,
    aesthetics,
    exif: xmp.exif,
    location,
    rating,
    autoTags: autoTags ? Object.keys(autoTags.tags) : [],
    contentCreatedAt: created,
    contentUpdatedAt: updated,
    integrationRunId,
  };
};

const upsertImage = (image: ReturnType<typeof toImageInsert>) =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.use(`lightroomImages.upsert:${image.id}`, (client) =>
      client
        .insert(lightroomImages)
        .values(image)
        .onConflictDoUpdate({
          target: lightroomImages.id,
          set: { ...image, recordUpdatedAt: new Date() },
        })
    );
  });

const persistAlbum = (album: LightroomJsonResponse) =>
  Effect.gen(function* () {
    const runId = yield* requireRunId;
    const { successes, failures } = yield* forEachCollect(album.resources, {
      concurrency: 10,
      label: (resource) => resource.asset.id,
      worker: (resource) => upsertImage(toImageInsert(resource, album.base, runId)),
    });
    yield* Effect.logInfo(
      `Upserted ${successes.length} of ${album.resources.length} Lightroom images`
    );
    yield* Effect.tryPromise({
      try: () => createMediaFromLightroomImages(),
      catch: (cause) => new DbError({ operation: 'lightroomImages.map', cause }),
    });
    return { entriesCreated: successes.length, failures } satisfies SyncSummary;
  });

const sync = Effect.gen(function* () {
  const album = yield* fetchAlbum;
  const sink = yield* DebugSink;
  if (sink.enabled) {
    yield* Effect.logInfo(
      `Debug mode: skipping database writes for ${album.resources.length} images`
    );
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  return yield* persistAlbum(album);
});

export const adobeIntegration: IntegrationDef = {
  integrationType: 'lightroom',
  sync,
};
