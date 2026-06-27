-- Lift + Run Program — log storage schema
-- Run this once against your Turso database to set up the table.
--
--   turso db shell fitness-charalampidi-gabriella < schema.sql
--
-- One row per (week, exercise). Saving the same week+exercise again
-- overwrites the previous value (UPSERT in the Worker).

CREATE TABLE IF NOT EXISTS logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  week        INTEGER NOT NULL,
  exercise    TEXT    NOT NULL,
  weight      TEXT,
  note        TEXT,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(week, exercise)
);

CREATE INDEX IF NOT EXISTS idx_logs_week ON logs(week);
