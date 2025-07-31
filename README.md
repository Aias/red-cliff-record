# Red Cliff Record

A personal knowledge repository that aggregates data from multiple external sources into a searchable, relational database. Built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Bun server.

**⚠️ Important Notice**: Red Cliff Record is still very much in progress and optimized for a single individual (the repository author) and his own idiosyncratic set of data sources, apps, and tools. It would probably be much less effective for anyone who doesn't use that exact set of tools. This is experimental software and could have breaking changes at any time—fork at your own risk!

## Architecture Overview

- **Frontend**: React 19 + TanStack (Start, Router, Query) + Tailwind CSS v4
- **Backend**: tRPC + Drizzle ORM + PostgreSQL
- **Deployment/Hosting**: Bun server + local PostgreSQL on a Tailscale network
- **Search**: PostgreSQL full-text search + OpenAI embeddings

For detailed development guidelines, see [CLAUDE.md](./CLAUDE.md) and cursor rules in [.cursor/rules/](./.cursor/rules/). Plenty of AI was used in the development of this project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js v22+** (check with `node --version`)
- **Bun** runtime & package manager (`curl -fsSL https://bun.sh/install | bash`)
- **PostgreSQL** (v14+ recommended)
- **Git** for version control
- **Cloudflare Account** - for R2 storage

### Optional Requirements

- **Airtable** - for Airtable integration
- **Arc Browser** - for Arc Browser integration
- **Dia Browser** - for Dia Browser integration
- **Feedbin** - for RSS feed integration
- **GitHub** - for GitHub integration
- **Raindrop.io** - for Raindrop.io integration
- **Readwise** - for Readwise integration
- **Twitter/X** - for Twitter/X bookmarks integration
- **Adobe Lightroom** - for Adobe Lightroom integration

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/red-cliff-record.git
cd red-cliff-record
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Database Setup

**Note about database providers**: The app connects to a local PostgreSQL database. If you use a different provider, update `src/server/db/connections/postgres.ts` accordingly.

#### Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE redcliffrecord;

# Exit psql
\q
```

#### Configure Database Connection

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update the `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://username:password@localhost:5432/redcliffrecord"
```

#### Run Migrations

**⚠️ Migration Warning**: The current migration history is extensive and may not run cleanly from scratch. If you encounter issues:

1. The seed data (predicates and core records) has been manually added to migrations `0034_slow_the_spike.sql` and `0036_petite_odin.sql`
2. You may need to create a fresh database schema instead of running all migrations sequentially
3. Consider using the database studio to manually inspect and fix any migration issues:

```bash
bun run db:studio
```

```bash
bun run db:migrate
```

### 4. Configure External Services

Edit your `.env` file and add API keys for the services you want to use:

#### Required Services

- **OpenAI** - For generating embeddings
  ```
  OPENAI_API_KEY=sk-...
  ```

#### Optional Integrations

Each integration is optional. Only configure the ones you need:

- **GitHub** - For syncing repositories and stars

  ```
  GITHUB_TOKEN=ghp_...
  ```

  [Create a token](https://github.com/settings/tokens) with `repo` and `user` scopes.

- **Airtable** - For syncing Airtable bases

  ```
  AIRTABLE_BASE_ID=app...
  AIRTABLE_ACCESS_TOKEN=pat...
  ```

  [Get your API key](https://airtable.com/create/tokens)

- **Raindrop.io** - For syncing bookmarks

  ```
  RAINDROP_TEST_TOKEN=...
  ```

  [Create an app](https://app.raindrop.io/settings/integrations) and get a test token.

- **Readwise** - For syncing highlights

  ```
  READWISE_TOKEN=...
  ```

  [Get your token](https://readwise.io/access_token)

- **Feedbin** - For syncing RSS feeds and entries

  ```
  FEEDBIN_USERNAME=your@email.com
  FEEDBIN_PASSWORD=your-password
  ```

  Sign up at [feedbin.com](https://feedbin.com)

- **Adobe Lightroom** - For syncing photos from a Lightroom album

  Note: Currently hardcoded to the author's album. See [INTEGRATIONS.md](./INTEGRATIONS.md#adobe-lightroom-integration) for setup details.

### Configure Cloudflare R2 Storage

For media storage, you'll need a Cloudflare R2 bucket:

1. [Create a Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Create an R2 bucket](https://dash.cloudflare.com/?to=/:account/r2/buckets)
3. [Create API tokens](https://dash.cloudflare.com/profile/api-tokens) with R2 read/write permissions
4. Update your `.env`:
   ```
   CLOUDFLARE_ACCOUNT_ID=...
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_REGION=auto
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_BUCKET=your-bucket-name
   ASSETS_DOMAIN=https://your-assets-domain.com
   ```

### Start Development Server

```bash
bun run dev
```

### Sync Individual Services

```bash
bun run sync:github
bun run sync:airtable
bun run sync:raindrop
bun run sync:readwise
bun run sync:feedbin
bun run sync:adobe
bun run sync:arc       # macOS only
bun run sync:dia       # macOS only
bun run sync:browsing  # Both Arc and Dia
```

## Production Build & Deployment

**⚠️ Security Warning**: This application currently has **no authentication or authorization**. If deployed publicly, anyone with the URL will have full read/write access to all data through the UI. Only deploy to production if you understand and accept this security risk, or implement authentication first.

### Build for Production

```bash
bun run build
```

### Deploy

1. Upload the `dist` folder to your server and start the Bun server.
2. Ensure all environment variables from `.env` are configured on your host.

## Development Commands

```bash
# Start development server
bun run dev

# Build for production
bun run build

# Type check
bun run tsc

# Lint, format, and type check (run before commits)
bun run lint

# Open database studio
bun run db:studio

# Run migrations
bun run db:migrate

# Backup database
bun run db:backup-local  # Local backup
bun run db:backup-remote # Remote backup
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `pg_ctl status` or `brew services list` (macOS)
- Check your `DATABASE_URL` format and credentials
- Verify the database exists: `psql -U postgres -l`

### Build Errors

- Clear cache: `rm -rf node_modules bun.lock dist && bun install`
- Check Node version: Should be v22+ as specified in `.nvmrc`
- Run type checking: `bun run tsc`

### Integration Sync Failures

- Verify API keys are correct and have proper permissions
- Check rate limits for external services
- Run individual syncs with verbose logging: `DEBUG=* bun run sync:github`

### Browser History Integration (macOS)

#### Arc Browser

- Ensure Arc browser is installed and has been used
- The integration reads from: `~/Library/Application Support/Arc/User Data/Default/History`
- May require security permissions in System Preferences

#### Dia Browser

- Ensure Dia browser is installed and has been used
- The integration reads from: `~/Library/Application Support/Dia/`
- May require security permissions in System Preferences

#### Browser Sync Details

- The sync runs Arc and Dia sequentially under one integration run
- Each browser maintains its own sync timestamp per hostname
- The browser sync works for any Chromium-based browser with path configuration

## License

MIT
