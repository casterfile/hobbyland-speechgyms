-- Fix: HTTP 500 "value too long for type character varying(50)" on POST /api/sessions
--
-- Two reasons we need this on Railway Postgres 2026-06-21:
--
-- 1. The 2026-03-19 dump we restored from (the only backup available when
--    the Azure n8n-hobbyland-pg was deleted) predates the
--    2026-05-13-widen-session-text-cols.sql migration, so mode/level/
--    education_level/language are still VARCHAR(50) on the new DB.
--
-- 2. The May migration missed `sentiment` — that column has always been
--    VARCHAR(50) but the backend writes up to 240 chars (backend/index.js
--    safeStr(s.sentiment, 240); backend/ai.js toShortStr(... 240, 'Neutral')).
--    So even on a fully-migrated Azure DB this was a latent bug; it just
--    happened that Anthropic's `sentiment` strings stayed under 50 chars
--    in practice. Tightening would be wrong — widen instead.
--
-- Idempotent: ALTER COLUMN ... TYPE VARCHAR(255) on a column already at 255
-- is a no-op in Postgres (no rewrite, no error). Safe to re-run.
--
-- Run against: Railway-managed Postgres in the `speechgyms` project.

BEGIN;

ALTER TABLE sessions
  ALTER COLUMN mode             TYPE VARCHAR(255),
  ALTER COLUMN level            TYPE VARCHAR(255),
  ALTER COLUMN education_level  TYPE VARCHAR(255),
  ALTER COLUMN language         TYPE VARCHAR(255),
  ALTER COLUMN sentiment        TYPE VARCHAR(255);

-- Verify
SELECT column_name, data_type, character_maximum_length
FROM   information_schema.columns
WHERE  table_name = 'sessions'
  AND  column_name IN ('mode','level','education_level','language','sentiment')
ORDER  BY column_name;

COMMIT;
