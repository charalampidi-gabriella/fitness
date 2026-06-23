# Apex Training — Setup Guide

You're building 3 pieces:

1. **Turso database** — stores your logs (you already have this).
2. **Cloudflare Worker** — the secure middle layer that holds your DB token.
3. **The phone app** (`index.html`) — talks to the Worker, syncs across devices.

Total time: ~15 minutes. You only do steps 1–3 once.

---

## Before you start

You need (all free):
- Your Turso database (done) + a **fresh** database token.
- A [Cloudflare account](https://dash.cloudflare.com/sign-up).
- Node.js installed (for the `wrangler` command-line tool).

> ⚠️ The token you pasted earlier is burned — make sure you rotated it. Generate a new one:
> ```
> turso db tokens create fitness-charalampidi-gabriella
> ```
> Keep this new token somewhere safe and private. It goes into Cloudflare, never into the app.

---

## Step 1 — Create the database table

From your machine (with the Turso CLI installed and logged in):

```bash
turso db shell fitness-charalampidi-gabriella < schema.sql
```

That creates the `logs` table. Done.

---

## Step 2 — Deploy the Worker

From inside the `apex-app` folder:

```bash
npm install -g wrangler        # if you don't have it
wrangler login                 # opens browser, sign in to Cloudflare

# Set your two secrets (you'll be prompted to paste each value):
wrangler secret put TURSO_TOKEN    # paste your FRESH Turso token
wrangler secret put APP_KEY        # invent a long random password, e.g. 32+ random chars

# Deploy:
wrangler deploy
```

When it finishes, wrangler prints a URL like:

```
https://apex-training-api.YOURNAME.workers.dev
```

**Copy that URL.** That's your Worker URL.

> The `APP_KEY` is a password you make up. It stops strangers from writing to your
> database. Pick something long and random. You'll paste it into the app in Step 3.
> Generate one quickly with:
> ```
> openssl rand -hex 24
> ```

---

## Step 3 — Open the app on your phone

You have two easy options to host `index.html`:

### Option A — Cloudflare Pages (recommended, free, gives you a real URL)
1. Go to Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Drag in `index.html` (rename a copy to `index.html` if needed — it already is).
3. Deploy. You get a URL like `https://apex-training.pages.dev`.
4. Open that URL on your phone.

### Option B — Just open the file
You can also email yourself `index.html` and open it in your phone browser, but a hosted
URL (Option A) is nicer because you can bookmark it and add it to your home screen.

### First launch
The app asks for two things — paste them once:
- **Worker URL** → the `...workers.dev` URL from Step 2
- **App Key** → the `APP_KEY` you invented in Step 2

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

- Every time you save a weight/note, it writes to Turso through your Worker.
- The app also keeps a **local cache**, so it opens instantly and works even with bad gym wifi.
- If you save while offline, it's queued and pushed automatically when you reconnect
  (or tap the status pill at the top to force a sync).
- The little pill under the title shows status: **Synced / Syncing / Offline / Sync error**.

---

## Troubleshooting

**"Couldn't connect" on the setup screen**
- Double-check the Worker URL (no trailing slash needed, the app handles it).
- Make sure the App Key matches the `APP_KEY` secret exactly.

**"unauthorized" / 401**
- The App Key in the app doesn't match the Worker secret. Re-run
  `wrangler secret put APP_KEY`, then re-enter the same value in the app
  (tap the status pill → it re-syncs; to fully re-enter, clear the site data or
  open in a private tab).

**"Turso 401" in a 500 error**
- Your `TURSO_TOKEN` is wrong or expired. Generate a new token and
  `wrangler secret put TURSO_TOKEN` again, then `wrangler deploy`.

**Want to wipe and start over**
- `turso db shell fitness-charalampidi-gabriella "DELETE FROM logs;"`

---

## Files in this folder

- `index.html` — the phone app (the only file your phone needs).
- `worker.js` — the Cloudflare Worker backend.
- `wrangler.toml` — Worker config.
- `schema.sql` — database table definition.
- `DEPLOY.md` — this guide.
