/**
 * Lift + Run — backend API (Vercel Edge Function)
 *
 * Catch-all handler for /api/*. Holds the Turso DB token server-side so it
 * never reaches the browser.
 *
 * Endpoints (relative to /api):
 *   GET  /logs          -> { logs: [ {week, exercise, weight, note}, ... ] }
 *   POST /logs          -> body: {week, exercise, weight, note}  (upsert)
 *   POST /logs/delete   -> body: {week, exercise}               (remove one)
 *
 * Required env vars (set in Vercel project settings):
 *   TURSO_URL    e.g. libsql://fitness-charalampidi-gabriella.aws-us-west-2.turso.io
 *   TURSO_TOKEN  fresh Turso database token
 *   APP_KEY      long random string — shared password the phone app sends
 */

export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Key",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function tursoQuery(sql, args = []) {
  const base = process.env.TURSO_URL
    .replace(/^libsql:\/\//, "https://")
    .replace(/\/$/, "");
  const url = `${base}/v2/pipeline`;

  const stmt = {
    sql,
    args: args.map((v) => {
      if (v === null || v === undefined) return { type: "null", value: null };
      if (typeof v === "number") {
        return Number.isInteger(v)
          ? { type: "integer", value: String(v) }
          : { type: "float", value: v };
      }
      return { type: "text", value: String(v) };
    }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TURSO_TOKEN}`,
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt },
        { type: "close" },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso ${res.status}: ${text}`);
  }

  const data = await res.json();
  const exec = data.results?.[0];
  if (!exec || exec.type !== "ok") {
    throw new Error(`Turso query failed: ${JSON.stringify(data)}`);
  }
  return exec.response?.result ?? null;
}

function rowsToObjects(result) {
  if (!result || !result.cols) return [];
  const cols = result.cols.map((c) => c.name);
  return (result.rows || []).map((row) => {
    const obj = {};
    row.forEach((cell, i) => {
      obj[cols[i]] = cell == null ? null : cell.value ?? null;
    });
    return obj;
  });
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";

  const key = request.headers.get("X-App-Key");
  if (!process.env.APP_KEY || key !== process.env.APP_KEY) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    if (request.method === "GET" && path === "/logs") {
      const result = await tursoQuery(
        "SELECT week, exercise, weight, note FROM logs ORDER BY week ASC"
      );
      const logs = rowsToObjects(result).map((r) => ({
        week: Number(r.week),
        exercise: r.exercise,
        weight: r.weight,
        note: r.note,
      }));
      return json({ logs });
    }

    if (request.method === "POST" && path === "/logs") {
      const body = await request.json();
      const { week, exercise, weight, note } = body || {};
      if (week == null || !exercise) {
        return json({ error: "week and exercise are required" }, 400);
      }
      await tursoQuery(
        `INSERT INTO logs (week, exercise, weight, note, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(week, exercise)
         DO UPDATE SET weight = excluded.weight,
                       note   = excluded.note,
                       updated_at = datetime('now')`,
        [Number(week), String(exercise), weight ?? "", note ?? ""]
      );
      return json({ ok: true });
    }

    if (request.method === "POST" && path === "/logs/delete") {
      const body = await request.json();
      const { week, exercise } = body || {};
      if (week == null || !exercise) {
        return json({ error: "week and exercise are required" }, 400);
      }
      await tursoQuery(
        "DELETE FROM logs WHERE week = ? AND exercise = ?",
        [Number(week), String(exercise)]
      );
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
