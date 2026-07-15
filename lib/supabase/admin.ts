import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. Uses the service_role key, which bypasses Row Level Security.
// Only ever import this inside app/api/**/route.ts files — never in a
// Client Component or anything that ships to the browser.
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
