-- 20 single-use trial codes for SpeechGyms, 3-day trial each.
-- Run against the SpeechGyms PostgreSQL DB (n8n-hobbyland-pg / speechgyms_db).
-- Idempotent: ON CONFLICT DO NOTHING on the unique `code` column.

INSERT INTO trial_codes (code, trial_days, max_uses, times_used, expires_at) VALUES
  ('GYM-ABLT-7TTJ', 3, 1, 0, NULL),
  ('GYM-B5MS-S8ZM', 3, 1, 0, NULL),
  ('GYM-W5A7-9TJ7', 3, 1, 0, NULL),
  ('GYM-ZJWU-D3BZ', 3, 1, 0, NULL),
  ('GYM-LKD3-95EW', 3, 1, 0, NULL),
  ('GYM-7E22-KEED', 3, 1, 0, NULL),
  ('GYM-SLXU-7N79', 3, 1, 0, NULL),
  ('GYM-35VE-5N82', 3, 1, 0, NULL),
  ('GYM-HXXU-UVY9', 3, 1, 0, NULL),
  ('GYM-W4EY-AP42', 3, 1, 0, NULL),
  ('GYM-J5WM-GDZ7', 3, 1, 0, NULL),
  ('GYM-W6VL-SV7C', 3, 1, 0, NULL),
  ('GYM-YZ7K-85HN', 3, 1, 0, NULL),
  ('GYM-KUWE-HS7A', 3, 1, 0, NULL),
  ('GYM-UCWE-PYEC', 3, 1, 0, NULL),
  ('GYM-JJUK-73Y6', 3, 1, 0, NULL),
  ('GYM-7Z7V-QEVF', 3, 1, 0, NULL),
  ('GYM-EJZM-6CA3', 3, 1, 0, NULL),
  ('GYM-UD63-BG26', 3, 1, 0, NULL),
  ('GYM-ASW4-Z8DK', 3, 1, 0, NULL)
ON CONFLICT (code) DO NOTHING;
