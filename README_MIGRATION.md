Migration & Deployment Notes

- Use the SQL files in `migrations/` to initialize your Cloudflare D1 instance.
- To import existing data, run `node scripts/import_dbjson_to_sql.js > migrations/003_from_dbjson.sql` and apply that SQL to D1.
- Passwords in the original `data/db.json` are scrypt-derived strings. Cloudflare Workers do not natively expose Node's `crypto.scrypt`. To preserve password verification you should either:
  - Run a one-time Node migration that re-hashes passwords using a Worker-compatible scheme (PBKDF2) and update `users.password_hash`, or
  - Vendor a pure-JS scrypt verifier into the Worker (not included here).
- After D1 is populated, deploy the Worker (use Wrangler or Pages Functions), bind the D1 and KV namespaces, and set `JWT_SECRET` in environment variables.

Deployment (local steps):
1. Install Wrangler and configure Cloudflare account.
2. Create a D1 database and note the binding id; put it in `workers/wrangler.toml` under `env.production.bindings`.
3. Create a KV namespace for caching if desired and set its id in `wrangler.toml`.
4. Run migrations: upload the SQL files to D1 via Wrangler or the Cloudflare dashboard.
5. Build the Worker with the `workers` package (esbuild) and deploy with Wrangler.
