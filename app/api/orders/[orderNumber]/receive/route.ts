import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { orderNumber: string } }) {
  const authed = createServerSupabase();
  const { data: { session } } = await authed.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const supabase = createAdminSupabase();

  // action: 'receive' (default) | 'revert-to-shipping' | 'edit-shipping'
  const action = body.action || 'receive';

  if (action === 'receive') {
    await supabase.from('orders').update({ status: 'received' }).eq('order_number', params.orderNumber);
  } else if (action === 'revert-to-shipping') {
    await supabase.from('orders').update({ status: 'shipping' }).eq('order_number', params.orderNumber);
  } else if (action === 'edit-shipping') {
    const { trackingNumber, carrier, date } = body;
    await supabase.from('orders').update({ shipping: { trackingNumber, carrier, date } }).eq('order_number', params.orderNumber);
  }

  return NextResponse.json({ ok: true });
}
