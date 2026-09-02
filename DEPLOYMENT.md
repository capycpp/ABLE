Cloudflare Deployment Guide

Prerequisites
- Install Wrangler: `npm install -g wrangler`
- Have a Cloudflare account with access to Pages/Workers and D1

Steps
1. Build the Worker bundle

```bash
cd workers
npm install
npm run build
```

2. Prepare the database migrations
- If you want to import the existing `data/db.json` into D1, run:

```bash
node ../scripts/import_dbjson_to_sql.js > migrations/003_from_dbjson.sql
```

3. Create a D1 database in the Cloudflare dashboard and note the database name or id.

4. Run the migrations against your D1 database (use Wrangler d1 execute):

```bash
# Example, replace <DATABASE_NAME> with your D1 database name
wrangler d1 execute --database <DATABASE_NAME> migrations/001_init.sql
wrangler d1 execute --database <DATABASE_NAME> migrations/002_seed.sql
wrangler d1 execute --database <DATABASE_NAME> migrations/003_from_dbjson.sql
```

5. Create a KV namespace (optional) and note its id for caching.

6. Update `workers/wrangler.toml` with the D1 binding id and KV namespace id and set a strong `JWT_SECRET`.

7. Publish the Worker

```bash
wrangler publish --name able-math-backend
```

8. Deploy the frontend to Cloudflare Pages
- Configure Pages to serve the static files in the repo root and route `/api/*` to the Worker or Pages Functions.

Notes
- Passwords in `data/db.json` were originally scrypt-derived; the new Worker uses PBKDF2. Because this workspace had no existing users, signups will create PBKDF2-hashed passwords. If you import scrypt hashes, perform a migration to re-hash or require password resets.
- Set environment secrets (e.g., `JWT_SECRET`) in the Cloudflare dashboard or using `wrangler secret put`.
