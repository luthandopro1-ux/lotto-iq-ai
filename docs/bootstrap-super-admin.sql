-- Lotto IQ AI — Lum Tech Solutions
-- Bootstrap one super administrator through the existing administrator allowlist.
--
-- IMPORTANT:
-- 1. Run this in the Supabase SQL Editor only after the Auth user already exists.
-- 2. This script does not create or change a password.
-- 3. Create/reset the password in Supabase Authentication, then enable MFA.
-- 4. Review the email address carefully before executing.
-- 5. Do not run this from an application client or expose service-role credentials.

BEGIN;

DO $$
DECLARE
  target_email text := lower('lumtechpro@gmail.com');
  target_user_id uuid;
  matched_users integer;
BEGIN
  SELECT count(*)::integer
    INTO matched_users
    FROM auth.users
   WHERE lower(email) = target_email;

  IF matched_users = 0 THEN
    RAISE EXCEPTION 'No Supabase Auth user exists for %. Create the Auth user first, then rerun this script.', target_email;
  END IF;

  IF matched_users > 1 THEN
    RAISE EXCEPTION 'More than one Auth user matches %. Stop and resolve the duplicate before granting admin access.', target_email;
  END IF;

  SELECT id
    INTO target_user_id
    FROM auth.users
   WHERE lower(email) = target_email
   LIMIT 1;

  INSERT INTO public.administrators (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Administrator allowlist updated for user id %.', target_user_id;
END $$;

-- Review the resulting allowlist entry without exposing passwords or tokens.
SELECT
  a.user_id,
  u.email,
  a.created_at
FROM public.administrators AS a
JOIN auth.users AS u ON u.id = a.user_id
WHERE lower(u.email) = lower('lumtechpro@gmail.com');

COMMIT;

-- Post-execution checks. These should return one row and true respectively.
SELECT
  EXISTS (
    SELECT 1
    FROM public.administrators AS a
    JOIN auth.users AS u ON u.id = a.user_id
    WHERE lower(u.email) = lower('lumtechpro@gmail.com')
  ) AS is_allowlisted;

-- Password handling is intentionally excluded from SQL.
-- Use Supabase Dashboard → Authentication → Users to invite or reset the user,
-- then require MFA for the administrator account before production use.
