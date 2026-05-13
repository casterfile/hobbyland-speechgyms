-- Fix: HTTP 500 "value too long for type character varying(50)" on POST /api/sessions
--
-- Root cause: backend/index.js safeStr() allows up to 60 chars for mode/level/
-- education_level/language but the sessions table columns are VARCHAR(50).
-- Widening to VARCHAR(255) gives generous headroom for future config keys.
--
-- Run against: speechgyms_db on n8n-hobbyland-pg.postgres.database.azure.com
-- Recommended runner: Azure Portal "Query editor (preview)" for the flexible
-- server, or Azure Cloud Shell — both run from inside Azure's network, no
-- firewall rule needed.

BEGIN;

ALTER TABLE sessions
  ALTER COLUMN mode             TYPE VARCHAR(255),
  ALTER COLUMN level            TYPE VARCHAR(255),
  ALTER COLUMN education_level  TYPE VARCHAR(255),
  ALTER COLUMN language         TYPE VARCHAR(255);

-- Verify
SELECT column_name, data_type, character_maximum_length
FROM   information_schema.columns
WHERE  table_name = 'sessions'
  AND  column_name IN ('mode','level','education_level','language')
ORDER  BY column_name;

COMMIT;
