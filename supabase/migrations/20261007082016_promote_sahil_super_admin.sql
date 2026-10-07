/*
# Promote sahilsingh9700@gmail.com to super admin

Adds the user sahilsingh9700@gmail.com as a super admin directly.
This is a one-time bootstrap for the platform owner.
*/

INSERT INTO public.super_admins (id, email)
SELECT id, email FROM auth.users WHERE email = 'sahilsingh9700@gmail.com'
ON CONFLICT (id) DO NOTHING;
