import { createAdminSupabase } from './supabase/admin';

// Deletes data that has no lasting value once it's stale — never touches
// orders, products, members, or auctions, which are kept forever.
export async function runDataCleanup() {
  const supabase = createAdminSupabase();

  // cart_reservations: the 10-minute payment-step hold. Anything expired
  // more than a day ago is definitely stale — give a little buffer past
  // the 10-minute window just in case, but no real reason to keep these.
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: deletedReservations } = await supabase
    .from('cart_reservations')
    .delete()
    .lt('expires_at', oneDayAgo)
    .select('id');

  // admin_logs: activity history. Keep 6 months of it — plenty for looking
  // back at "what happened last month", but old enough entries are pruned
  // so the table doesn't grow forever.
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
  const { data: deletedLogs } = await supabase
    .from('admin_logs')
    .delete()
    .lt('created_at', sixMonthsAgo)
    .select('id');

  return {
    reservationsDeleted: deletedReservations?.length || 0,
    logsDeleted: deletedLogs?.length || 0,
  };
}
