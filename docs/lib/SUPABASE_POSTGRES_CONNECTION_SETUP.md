# Supabase Postgres Connection Setup (Next.js + `pg`)

Use this guide to set up direct Postgres transactions with Supabase in this project.

## Scope

- App runtime: Next.js server runtime (Node.js)
- Driver: `pg`
- Entry point: [`src/lib/supabase/postgres.ts`](../../src/lib/supabase/postgres.ts)

## 1. Install dependency

```bash
npm i pg
```

## 2. Use the Pooler connection string

From Supabase dashboard:

- `Project Settings` -> `Database` -> `Connection string`
- Choose pooler endpoint (port `6543`)

Recommended format:

```env
POSTGRES_URL="postgresql://postgres.<project-ref>:<REAL_PASSWORD>@<region>.pooler.supabase.com:6543/postgres?sslmode=verify-full"
```

Notes:

- Replace `<REAL_PASSWORD>` with real password (not `[YOUR-PASSWORD]`).
- URL-encode password if it contains reserved characters (`@`, `:`, `/`, `?`, `#`).

## 3. Configure CA trust for Node (`NODE_EXTRA_CA_CERTS`)

If TLS verification fails (for example `self-signed certificate in certificate chain`), add Supabase CA certs for Node:

1. Get certificate chain:

```bash
openssl s_client -starttls postgres \
  -connect <region>.pooler.supabase.com:6543 \
  -servername <region>.pooler.supabase.com \
  -showcerts
```

2. Create local bundle with:

- `Supabase Intermediate 2021 CA`
- `Supabase Root 2021 CA`

```bash
mkdir -p ~/.certs
cat > ~/.certs/supabase-ca-bundle.pem <<'PEM'
-----BEGIN CERTIFICATE-----
# Supabase Intermediate 2021 CA (full cert)
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
# Supabase Root 2021 CA (full cert)
-----END CERTIFICATE-----
PEM
```

3. Set env in `.env.local`:

```env
NODE_EXTRA_CA_CERTS="/Users/<you>/.certs/supabase-ca-bundle.pem"
```

## 4. Restart Next.js

```bash
npm run dev
```

This repo uses `scripts/run-next.sh` for `dev/build/start`, so `.env` / `.env.local` and `NODE_EXTRA_CA_CERTS` are loaded before launching Next.js.

## 5. Quick verification checklist

1. DNS:

```bash
nslookup <region>.pooler.supabase.com
```

2. App route health:

- Open `/admin/ai/review-queue`
- Expect `200` instead of runtime connection error

3. No insecure fallback:

- Avoid `sslmode=no-verify` except temporary local debugging.

## Troubleshooting

### `getaddrinfo ENOTFOUND ...`

Cause: hostname cannot be resolved.

Checks:

- Verify host in `POSTGRES_URL`
- Prefer pooler host from Supabase dashboard
- `nslookup <host>`

### `self-signed certificate in certificate chain`

Cause: Node does not trust CA chain.

Fix:

- Keep `sslmode=verify-full`
- Set `NODE_EXTRA_CA_CERTS` to a PEM bundle containing required CA certs

### `SECURITY WARNING: sslmode require treated as verify-full`

Current `pg` behavior warns that `require` aliases to `verify-full`.

Recommended:

- Use `sslmode=verify-full` explicitly.
