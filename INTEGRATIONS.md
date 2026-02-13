# Integration Setup Guide

This guide provides detailed setup instructions for each integration in Red Cliff Record.

## Sync via CLI (optional)

Install the CLI once from the repo, then run syncs via `rcr`:

```bash
bun link
```

You can run integrations with the CLI instead of the per-integration scripts:

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

## Airtable Integration

Syncs records from Airtable bases with a specific structure.

**Important**: This integration is configured specifically for the database structure used by the [barnsworthburning](https://github.com/Aias/barnsworthburning) project. If you want to use Airtable as a data source, you should:

1. Fork the barnsworthburning repository
2. Set up your own Airtable base following that project's structure
3. Configure the integration with your base ID and token

### Setup

1. Go to [Airtable API](https://airtable.com/create/tokens)
2. Create a new personal access token
3. Give it a read-only scope
4. Add your base to the token's access list
5. Copy token to `.env` as `AIRTABLE_ACCESS_TOKEN`
6. Find your base ID (starts with 'app') from Airtable URL
7. Add to `.env` as `AIRTABLE_BASE_ID`

### What Gets Synced

- All records from configured tables
- Attachments and media
- Rich text content
- Record relationships

### Sync Command

```bash
rcr sync airtable
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

This runs both Arc and Dia syncs sequentially under a single integration run.

### Adding Other Chromium Browsers

To add support for other Chromium-based browsers:

1. Create a new browser config in `src/server/integrations/browser-history/browsers/`
2. Update the database connection to point to the browser's history file
3. Add the browser to the `browserEnum` in the database schema
4. Create a sync script following the Arc/Dia pattern

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

This runs: browsing, raindrop, readwise, github, airtable, twitter, then enrichments (avatars, alt-text, embeddings). Adobe, feedbin, and agents are excluded—run them individually if needed.

## Rate Limits and Best Practices

- **GitHub**: 5,000 requests/hour for authenticated requests
- **Airtable**: 5 requests/second per base
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
