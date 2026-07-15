import { createBrowserClient } from '@supabase/ssr';

// Used in Client Components. Only has the public "anon" key,
// which is safe to expose — RLS policies decide what it can touch.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
