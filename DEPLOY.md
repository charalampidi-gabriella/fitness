# Lift + Run — Setup Guide

You're wiring up 3 pieces:

1. **Turso database** — stores your logs (you already have this).
2. **Vercel deployment** — hosts both the phone app (`index.html`) and the API (`api/[...path].js`) that holds your DB token.
3. **The phone app** — opened from your Vercel URL, syncs across devices.

Total time: ~10 minutes. You only do steps 1–3 once.

---

## Before you start

You need (all free):
- Your Turso database (done) + a **fresh** database token.
- A [Vercel account](https://vercel.com/signup) — sign in with GitHub.
- This repo pushed to GitHub (done): `charalampidi-gabriella/fitness`.

> ⚠️ The token you pasted earlier is burned — make sure you rotated it. Generate a new one:
> ```
> turso db tokens create fitness-charalampidi-gabriella
> ```
> Keep this new token somewhere safe and private. It goes into Vercel, never into the app.

---

## Step 1 — Create the database table

From your machine (with the Turso CLI installed and logged in):

```bash
turso db shell fitness-charalampidi-gabriella < schema.sql
```

That creates the `logs` table. Done.

---

## Step 2 — Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and **Import** the `charalampidi-gabriella/fitness` repo.
2. Framework Preset: **Other** (Vercel auto-detects the static `index.html` + `api/` Edge Function).
3. Before clicking **Deploy**, expand **Environment Variables** and add all three:

   | Name           | Value                                                                 |
   | -------------- | --------------------------------------------------------------------- |
   | `TURSO_URL`    | `libsql://fitness-charalampidi-gabriella.aws-us-west-2.turso.io`      |
   | `TURSO_TOKEN`  | your fresh Turso token                                                |
   | `APP_KEY`      | a long random password you invent (e.g. `openssl rand -hex 24`)       |

4. Click **Deploy**. When it finishes you get a URL like:

   ```
   https://fitness-yourname.vercel.app
   ```

   That's your app.

> The `APP_KEY` is a password you make up. It stops strangers from writing to your
> database. Pick something long and random. You'll paste it into the app in Step 3.

**Changed an env var later?** Vercel → your project → **Settings → Environment Variables** → edit → then **Deployments** → **Redeploy** the latest one (env changes don't apply to existing deployments).

---

## Step 3 — Open the app on your phone

Open your Vercel URL on your phone. The app asks for two things — paste them once:

- **API URL** → your Vercel URL with `/api` appended, e.g. `https://fitness-yourname.vercel.app/api`
- **App Key** → the `APP_KEY` you set in Step 2

Tap **Connect**. It pulls any existing logs and you're in.

Repeat this one-time connect on any other device (laptop, second phone) and they'll all
sync to the same database.

---

## Add to home screen (feels like a real app)

**iPhone (Safari):** Share button → *Add to Home Screen*.
**Android (Chrome):** ⋮ menu → *Add to Home screen*.

It opens full-screen with no browser bar.

---

## How syncing works

- Every time you save a weight/note, it writes to Turso through the Vercel API.
- The app also keeps a **local cache**, so it opens instantly and works even with bad gym wifi.
- If you save while offline, it's queued and pushed automatically when you reconnect
  (or tap the status pill at the top to force a sync).
- The little pill under the title shows status: **Synced / Syncing / Offline / Sync error**.

---

## Troubleshooting

**"Couldn't connect" on the setup screen**
- Double-check the API URL — it must end in `/api` (no trailing slash needed).
- Make sure the App Key matches the `APP_KEY` env var exactly.

**"unauthorized" / 401**
- The App Key in the app doesn't match the Vercel env var. Update `APP_KEY` in
  Vercel → Settings → Environment Variables, **redeploy**, then re-enter the same value
  in the app (tap the status pill → it re-syncs; to fully re-enter, clear the site
  data or open in a private tab).

**"Turso 401" in a 500 error**
- Your `TURSO_TOKEN` is wrong or expired. Generate a new token, update it in
  Vercel env vars, then redeploy.

**Want to wipe and start over**
- `turso db shell fitness-charalampidi-gabriella "DELETE FROM logs;"`

---

## Files in this repo

- `index.html` — the phone app (the only file your phone needs).
- `api/[...path].js` — the Vercel Edge Function backend (handles `/api/logs` and `/api/logs/delete`).
- `schema.sql` — database table definition.
- `DEPLOY.md` — this guide.
