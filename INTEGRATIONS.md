# Integration Setup Guide

This guide provides detailed setup instructions for each integration in Red Cliff Record.

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
pnpm sync:github
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
pnpm sync:airtable
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
pnpm sync:raindrop
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
pnpm sync:readwise
```

## Arc Browser Integration (macOS Only)

Syncs your Arc browser history locally.

### Setup

1. Install Arc browser and use it normally
2. No API key required - reads local history database

### Requirements

- macOS only
- Arc browser must be installed
- Script needs read access to: `~/Library/Application Support/Arc/`

### What Gets Synced

- Browsing history
- Page titles
- Visit timestamps
- Favicons

### Sync Command

```bash
pnpm sync:arc
```

### Troubleshooting

- If sync fails, check System Preferences > Security & Privacy
- May need to grant terminal/IDE file access permissions

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
pnpm sync:adobe
```

## Twitter/X Integration

Captures Twitter bookmarks (manual process).

### Setup

1. No API key required (uses browser console)
2. Manual capture process due to API limitations

### Capture Process

1. Open Twitter/X in your browser
2. Open browser developer console (F12)
3. Copy and run the script from `src/server/integrations/twitter/bookmarks.js`
4. Navigate to your bookmarks
5. Scroll to the bottom of the page (or until you see bookmarks from the last time you ran the script)
6. Save the output JSON to `/Red Cliff Record/twitter-bookmarks.json` (or wherever you'd like, but make sure to update the path in the sync command)
7. Import using the sync command

### What Gets Captured

- Bookmarked tweets
- Tweet content
- Author information
- Media URLs

### Sync Command

```bash
# After manual capture
pnpm sync:twitter
```

## Running All Integrations

To sync all configured integrations at once:

```bash
pnpm sync:daily
```

This runs all integrations that have valid API keys configured. Manually updated integrations (Twitter and Adobe) are not run by this command.

## Rate Limits and Best Practices

- **GitHub**: 5,000 requests/hour for authenticated requests
- **Airtable**: 5 requests/second per base
- **Raindrop**: 120 requests/minute
- **Readwise**: Reasonable use expected
- **Arc**: Local only, no rate limits

### Scheduling Syncs

For production use, consider setting up a cron job:

```bash
# Sync daily at 2 AM
0 2 * * * cd /path/to/red-cliff-record && pnpm sync:daily
```

## Debugging Integration Issues

Enable debug logging:

```bash
DEBUG=* pnpm sync:github
```

Check integration-specific tables in the database:

```bash
pnpm db:studio
```

View sync logs in the `operations` table for detailed error messages.
