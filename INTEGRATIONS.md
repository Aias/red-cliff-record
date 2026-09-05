# Integration Setup Guide

This guide provides detailed setup instructions for each integration in Red Cliff Record.

## Sync via CLI (optional)

Install the CLI once from the repo, then run syncs via `rcr`:

```bash
bun link
```

Run integrations with the CLI:

```bash
rcr sync github
rcr sync
```

Flags are strict (unknown options error). Use `--format=table` for human-readable output.

### Debug Mode

Use `--debug` to test API connectivity without writing to the database:

```bash
rcr sync github --debug
```

Debug mode:

- Fetches data from the API as normal
- Skips all database writes
- Skips enrichments (avatars, alt-text, embeddings)
- Outputs raw API responses to `.temp/<integration>-<timestamp>.json`
- Useful for testing credentials, viewing raw data, and debugging API issues

## GitHub Integration

Syncs your GitHub repositories, stars, and commits.

### Setup

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set expiration as desired
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `user` (Read user profile data)
5. Generate token and copy to `.env` as `GITHUB_TOKEN`

### What Gets Synced

- Your repositories (public and private)
- Starred repositories
- Recent commits, including AI-generated summaries and metadata for each commit
- User profiles

### Sync Command

```bash
rcr sync github
```

## Raindrop.io Integration

Syncs your bookmarks and collections.

### Setup

1. Go to [Raindrop.io Integrations](https://app.raindrop.io/settings/integrations)
2. Click "Create new app"
3. Fill in app details (name, description)
4. After creation, click on your app
5. Copy the "Test token" to `.env` as `RAINDROP_TEST_TOKEN`

### What Gets Synced

- All bookmarks
- Collections
- Tags
- Cover images
- Descriptions

### Sync Command

```bash
rcr sync raindrop
```

## Readwise Integration

Syncs your reading highlights and notes.

### Setup

1. Go to [Readwise Access Token](https://readwise.io/access_token)
2. Copy your access token
3. Add to `.env` as `READWISE_TOKEN`

### What Gets Synced

- Book highlights
- Article highlights
- Podcast notes
- Personal notes
- Source metadata

### Sync Command

```bash
rcr sync readwise
```

### Highlight cleanup

New highlights import Reader's formatted Markdown before they become RCR records. When the formatted fetch fails, the highlights wait for the next sync. Existing records keep their text.

Cleanup compares each highlight with the document HTML saved by Reader, fetching and storing the HTML for documents synced without it. It restores source formatting, removes footnote markers, and recovers selected images as URL-backed media attachments. Highlights stay separate unless you merge them. Only continuous or overlapping selections can merge; unselected prose and media keep selections apart.

Open cleanup from a Readwise document or highlight in the record toolbar. The preview lists every highlight, selects each proposed change by default, and lets you deselect changes or merge eligible neighbors before applying. Existing edits, curated records, ambiguous matches, and unsupported media stay flagged for review. Applying a stale preview fails without changing records. Merges keep notes, links, media, and curation data on the surviving highlight, and an undo action reverses everything applied.

The spelling and grammar check uses OpenAI for small literal corrections. It is enabled by default in the preview dialog, and its suggestions stay flagged for review. Automatic cleanup never runs it.

`READWISE_CLEANUP_MODE` controls cleanup during sync:

| Value               | Behavior                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `preview` (default) | Import formatted highlights only. Review documents through the toolbar action.             |
| `automatic`         | Also apply warning-free, single-highlight corrections to the records created by that sync. |

A warning-free change is one whose highlight was located exactly once in the saved page, whose record has neither manual edits nor a curation date, and whose selection contains no embedded media, formula, or text the Markdown conversion could not preserve.

Neither mode touches existing records. Merging requires an explicit choice in a document preview. To backfill the library, `rcr readwise cleanup` applies the same warning-free changes to every document with highlights, newest first, optionally limited with `--since <date>` and `--until <date>` to documents saved in that range and with `--limit <n>` to a number of documents. `--dry-run` reports counts without changing records (fetched HTML is still stored). Each run writes the undo snapshots of the documents it changed to a file, and `rcr readwise undo <file>` reverses that run.

The CLI offers the same preview and selective apply:

```bash
rcr readwise preview 123 --raw > preview.json
rcr readwise preview 123 --editorial --raw > preview.json
rcr readwise apply preview.json --records 124,125
rcr readwise cleanup --since 2025-01-01 --until 2025-04-01 --dry-run
rcr readwise cleanup --snapshots cleanup.jsonl
rcr readwise undo cleanup.jsonl
```

The `--records` ids name the surviving highlight of each change to apply. Reader's formatted highlights come from the [Readwise MCP service](https://readwise.io/mcp) with the same `READWISE_TOKEN`.

## Feedbin Integration

Syncs your RSS feed subscriptions and entries from Feedbin.

### Setup

1. Create a [Feedbin](https://feedbin.com) account if you don't have one
2. Add your Feedbin credentials to `.env`:
   ```
   FEEDBIN_USERNAME=your@email.com
   FEEDBIN_PASSWORD=your-password
   ```

### What Gets Synced

- All feed subscriptions
- Feed entries (unread, starred, and recently read)
- Feed metadata and icons
- Read/starred status
- Differential sync for starred items (only syncs changes)
- Embeddings generated after initial sync

### Sync Command

```bash
rcr sync feedbin
```

### Features

- Incremental sync based on last sync time
- Efficient starred entry syncing (only fetches new starred items)
- Automatic feed discovery for entries without feeds
- Batch processing for embeddings
- Enclosure/podcast support

## Browser History Integration (macOS Only)

Syncs browsing history from Chromium-based browsers locally. Currently configured for Arc and Dia browsers, but the same approach works for any Chromium-based browser (Chrome, Edge, Brave, etc.) with path adjustments.

### Arc Browser

#### Setup

1. Install Arc browser and use it normally
2. No API key required - reads local history database

#### Requirements

- macOS only
- Arc browser must be installed
- Script needs read access to: `~/Library/Application Support/Arc/`

#### What Gets Synced

- Browsing history
- Page titles
- Visit timestamps
- Favicons

### Troubleshooting

- If sync fails, check System Preferences > Security & Privacy
- May need to grant terminal/IDE file access permissions

### Dia Browser

#### Setup

1. Install Dia browser and use it normally
2. No API key required - reads local history database

#### Requirements

- macOS only
- Dia browser must be installed
- Script needs read access to: `~/Library/Application Support/Dia/`

#### What Gets Synced

- Browsing history
- Page titles
- Visit timestamps
- Search terms

### Sync Command

```bash
rcr sync browsing
```

This runs both Arc and Dia syncs under a single integration run.

History is tracked per machine hostname. Syncing from a hostname the database has never seen fails with an error listing the known hostnames; pass `--allow-new-hostname` to confirm the new machine:

```bash
rcr sync browsing --allow-new-hostname
```

### Adding Other Chromium Browsers

To add support for other Chromium-based browsers:

1. Add the browser to the `BROWSERS` list in `src/server/integrations/browser-history/sync.ts` with its history file path
2. Add the browser to the `browserEnum` in the database schema

Common browser history locations on macOS:

- Chrome: `~/Library/Application Support/Google/Chrome/Default/History`
- Edge: `~/Library/Application Support/Microsoft Edge/Default/History`
- Brave: `~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History`

## Adobe Lightroom Integration

Syncs photos from a publicly shared Adobe Lightroom album.

**Important**: This integration is currently hardcoded to sync from the author's personal Lightroom album. To use this integration with your own photos:

1. Create an Adobe Lightroom account
2. Upload your photos to Lightroom
3. Create an album and make it publicly shareable
4. Get the public album URL
5. Modify the `ALBUM_URL` in `src/server/integrations/adobe/sync.ts` to point to your album

### Setup

1. No API key required for publicly shared albums
2. You'll need to modify the hardcoded album URL in the sync script

### What Gets Synced

- All photos from the specified Lightroom album
- Photo metadata (camera info, EXIF data, ratings)
- 2048px renditions of images
- Auto-generated tags from Adobe's AI
- Location data if available

### Sync Command

```bash
rcr sync adobe
```

## Twitter/X Integration

Syncs Twitter bookmarks using the native GraphQL API with cookie-based authentication.

### Setup

1. Log into Twitter/X in your browser
2. Open DevTools → Application → Cookies → x.com
3. Copy the `auth_token` cookie value to `.env` as `TWITTER_AUTH_TOKEN`
4. Copy the `ct0` cookie value to `.env` as `TWITTER_CT0`

Note: These tokens expire periodically and will need to be refreshed when sync fails with auth errors.

### What Gets Synced

- All bookmarked tweets
- Tweet content and metadata
- Author information (username, display name, avatar)
- Media attachments (images, videos)
- Quoted tweets

### Sync Command

```bash
rcr sync twitter
```

## Running All Integrations

To sync all configured integrations at once:

```bash
rcr sync
```

This runs: browsing, raindrop, readwise, github, twitter, then enrichments (avatars, alt-text, embeddings). Adobe and feedbin are excluded—run them individually if needed.

## Rate Limits and Best Practices

- **GitHub**: 5,000 requests/hour for authenticated requests
- **Raindrop**: 120 requests/minute
- **Readwise**: Reasonable use expected
- **Feedbin**: Reasonable use expected
- **Arc/Dia**: Local only, no rate limits

### Scheduling Syncs

For production use, consider setting up a cron job:

```bash
# Sync daily at 2 AM
0 2 * * * cd /path/to/red-cliff-record && rcr sync
```

## Debugging Integration Issues

### Debug Mode

Use `--debug` to fetch data without writing to the database:

```bash
rcr sync github --debug
```

This outputs raw API responses to `.temp/github-<timestamp>.json` for inspection.

### Database Inspection

Check integration-specific tables in the database:

```bash
bun run db:studio
```

View sync logs in the `operations` table for detailed error messages.
