# Red Cliff Record

A personal knowledge repository that aggregates data from multiple external sources into a searchable, relational database. Built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Bun server.

**⚠️ Important Notice**: Red Cliff Record is still very much in progress and optimized for a single individual (the repository author) and his own idiosyncratic set of data sources, apps, and tools. It would probably be much less effective for anyone who doesn't use that exact set of tools. This is experimental software and could have breaking changes at any time—fork at your own risk!

## Architecture Overview

- **Frontend**: React 19 + TanStack (Start, Router, Query) + Tailwind CSS v4
- **Backend**: tRPC + Drizzle ORM + PostgreSQL
- **Deployment/Hosting**: Bun server + local PostgreSQL on a Tailscale network
- **Search**: PostgreSQL full-text search + OpenAI embeddings

For detailed development guidelines, see [AGENTS.md](./AGENTS.md). Plenty of AI was used in the development of this project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Bun** runtime & package manager (`curl -fsSL https://bun.sh/install | bash`)
- **Node.js v24+** (check with `node --version`)
- **PostgreSQL** (v14+ recommended) with the following extensions:
  - `vector` - for vector embeddings (install via `CREATE EXTENSION vector;`)
  - `pg_trgm` - for trigram text search (install via `CREATE EXTENSION pg_trgm;`)
  - Note: Extensions are automatically created by migrations if your user has permission
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

### 2.5 Install CLI (Optional)

```bash
bun link
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

The migration system uses Drizzle ORM and includes all necessary PostgreSQL extensions (`vector`, `pg_trgm`) in the initial migration. Run migrations with:

```bash
bun run db:migrate
```

**Note**: The initial migration (`0000_rapid_triathlon.sql`) creates the `extensions` schema and installs required extensions. Ensure your PostgreSQL user has permission to create extensions, or install them manually before running migrations:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### Seed Initial Data

After running migrations, seed the database with initial predicate vocabulary and core records:

```bash
./src/server/db/db-manager.sh seed local
```

This loads:

- **Predicates**: Canonical relationship types (e.g., `created_by`, `contains`, `references`, `related_to`)
- **Records**: Core entities (e.g., user record, project record)

The seed script is idempotent and safe to run multiple times—it uses upsert logic to avoid duplicates.

To inspect your database:

```bash
bun run db:studio
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

### CLI (rcr)

`rcr` is a local CLI wrapper around the same tRPC procedures used by the app. It is JSON-first by default and supports a table output for quick inspection.

Install the CLI globally once from the repo:

```bash
bun link
```

```bash
# General help
rcr --help

# Records
rcr records get 123
rcr records get 123 --links              # Include all incoming/outgoing links
rcr records get 123 456 789              # Multiple IDs in parallel
rcr records list --type=entity --limit=10
rcr records list --source=github --limit=10
rcr records create '{"title":"Example","type":"concept"}'

# Search
rcr search "machine learning"
rcr search semantic "machine learning" --limit=5
rcr search similar 456 --limit=5

# Links
rcr links list 123
rcr links list 123 456                   # Multiple records
rcr links create '{"sourceId":1,"targetId":2,"predicateId":3}'

# Sync integrations
rcr sync github
rcr sync airtable
rcr sync raindrop
rcr sync readwise
rcr sync feedbin
rcr sync adobe
rcr sync browsing                       # Arc + Dia browser history (macOS)
rcr sync twitter
rcr sync agents                         # Claude, Codex, Cursor histories
rcr sync avatars                        # Transfer avatars to R2
rcr sync embeddings                     # Generate embeddings for records
rcr sync daily                          # Run all daily syncs
```

Notes:

- Outputs compact JSON by default; pipe to `jq` for formatting.
- Unknown flags are rejected (strict parsing).
- Most ID-based commands accept multiple IDs for parallel execution.
- Use `--format=table` for human-readable output.
- Use `--debug` to fetch data without writing to the database (outputs to `.temp/`).
- Use `--` to stop option parsing when needed.

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

# Lint and type check (oxlint + tsgo, fast—run frequently)
bun run lint

# Format code (Prettier, run before commits)
bun run format

# Open database studio
bun run db:studio

# Run migrations
bun run db:migrate

# Database Management
bun run db:backup-local  # Local backup
bun run db:backup-remote # Remote backup
bun run db:restore-local # Restore local backup
bun run db:restore-remote # Restore remote backup

# Note: Restores terminate existing connections to the target database before running pg_restore.
# Tip: Use --dry-run (or -n) with db-manager.sh to print commands without executing.

# Database Reset Workflow
# If you need to squash migrations or reset the schema while preserving data:
# 1. Backup data only
./src/server/db/db-manager.sh -D backup local

# 2. Reset database (drops DB, recreates with extensions, empty schema)
./src/server/db/db-manager.sh reset local

# 3. Clear old migration history (optional/manual step)
# rm -rf migrations/main/*

# 4. Generate new migration (if clearing history)
# bun run db:generate

# 5. Apply migrations
bun run db:migrate

# 6. Seed initial data (predicates and core records)
./src/server/db/db-manager.sh seed local

# 7. Restore data only
./src/server/db/db-manager.sh -D restore local
```

## Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running: `pg_ctl status` or `brew services list` (macOS)
- Check your `DATABASE_URL` format and credentials
- Verify the database exists: `psql -U postgres -l`

### Build Errors

- Clear cache: `rm -rf node_modules bun.lock dist && bun install`
- Check Node version: Should be v24+ as specified in `.nvmrc`
- Run lint and type check: `bun run lint`

### Integration Sync Failures

- Verify API keys are correct and have proper permissions
- Check rate limits for external services
- Run with `--debug` to test API connectivity without writing to the database:
  ```bash
  rcr sync github --debug  # Outputs raw API data to .temp/
  ```

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
