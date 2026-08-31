# ABLE v2

A multi-page ABLE Olympiad Mathematics platform with:
- cinematic animated gradient/glow homepage (no astronaut image)
- separate Problems, Contests, Articles, Archive and About Us pages
- real server-side signup/login using Node's built-in crypto.scrypt
- cookie sessions
- admin panel for Problems, Articles and Contests CRUD + user list
- JSON data store in `data/db.json` (no external database dependency)

## Run locally

1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run:

```bash
npm start
```

4. Open http://localhost:3000

## Admin

On first run an admin is created automatically:
- Email: `admin@able.local`
- Password: `ChangeMe123!`

For a real deployment, set environment variables before the first run:
- `ABLE_ADMIN_EMAIL`
- `ABLE_ADMIN_PASSWORD`

Example PowerShell:

```powershell
$env:ABLE_ADMIN_EMAIL="your-admin-email@example.com"
$env:ABLE_ADMIN_PASSWORD="a-strong-password"
npm start
```

## Important for public deployment

This is a complete working starter/local platform, not a hardened production SaaS. For public launch, move the JSON store to PostgreSQL/SQLite, use persistent sessions, HTTPS, CSRF protection, rate limiting, email verification and password-reset flows.
