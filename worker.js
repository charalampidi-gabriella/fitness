/**
 * Apex Training Program — backend API (Cloudflare Worker)
 *
 * This is the secure middle layer between your phone app and Turso.
 * Your database token lives here as a Worker SECRET — it is NEVER sent
 * to the browser.
 *
 * Endpoints:
 *   GET  /logs            -> { logs: [ {week, exercise, weight, note}, ... ] }
 *   POST /logs            -> body: {week, exercise, weight, note}  (upsert)
 *   POST /logs/delete     -> body: {week, exercise}               (remove one)
 *
 * Secrets / vars you must set (see DEPLOY.md):
 *   TURSO_URL      e.g. https://fitness-charalampidi-gabriella.aws-us-west-2.turso.io
 *   TURSO_TOKEN    your fresh database token
 *   APP_KEY        a long random string you invent — a simple shared password
 *                  so randos can't write to your DB. The phone app sends it.
 */

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

/**
 * Call Turso's HTTP API (hrana / pipeline endpoint).
 * We convert the libsql:// URL to https:// automatically.
 */
async function tursoQuery(env, sql, args = []) {
  const base = env.TURSO_URL.replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
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
      Authorization: `Bearer ${env.TURSO_TOKEN}`,
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

/** Turn a Turso result object into plain JS row objects. */
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // Simple shared-key auth on every request.
    const key = request.headers.get("X-App-Key");
    if (!env.APP_KEY || key !== env.APP_KEY) {
      return json({ error: "unauthorized" }, 401);
    }

    try {
      // GET /logs  — return everything
      if (request.method === "GET" && url.pathname === "/logs") {
        const result = await tursoQuery(
          env,
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

      // POST /logs  — upsert one entry
      if (request.method === "POST" && url.pathname === "/logs") {
        const body = await request.json();
        const { week, exercise, weight, note } = body || {};
        if (week == null || !exercise) {
          return json({ error: "week and exercise are required" }, 400);
        }
        await tursoQuery(
          env,
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

      // POST /logs/delete  — remove one entry
      if (request.method === "POST" && url.pathname === "/logs/delete") {
        const body = await request.json();
        const { week, exercise } = body || {};
        if (week == null || !exercise) {
          return json({ error: "week and exercise are required" }, 400);
        }
        await tursoQuery(
          env,
          "DELETE FROM logs WHERE week = ? AND exercise = ?",
          [Number(week), String(exercise)]
        );
        return json({ ok: true });
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  },
};
