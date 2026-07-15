import { createClient } from './supabase/client';

// Fire-and-forget: records what the currently logged-in admin just did.
// Never throws — logging failures shouldn't block the actual action.
export async function logAdminAction(message: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.from('admin_logs').insert({ admin_email: user.email, message });
  } catch (e) {
    console.error('logAdminAction failed', e);
  }
}
