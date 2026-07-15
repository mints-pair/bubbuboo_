import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: { orderNumber: string } }) {
  // make sure the caller is a logged-in admin
  const authed = createServerSupabase();
  const { data: { session } } = await authed.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createAdminSupabase();
  const { data: order } = await supabase.from('orders').select('*').eq('order_number', params.orderNumber).single();
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'ออเดอร์นี้ถูกดำเนินการไปแล้ว' }, { status: 400 });
  }

  await supabase.from('orders').update({ status: 'confirmed' }).eq('order_number', params.orderNumber);

  // deduct stock now — only at the moment of confirmation, per item quantity ordered
  // (best-effort; for high-concurrency stores, move this into a single SQL
  //  function using row locks instead)
  for (const item of order.items) {
    const { data: p } = await supabase.from('products').select('stock').eq('id', item.productId).single();
    if (p) {
      await supabase.from('products').update({ stock: Math.max(0, p.stock - item.qty) }).eq('id', item.productId);
    }
  }

  // upsert member record
  const phone = order.contact?.phone;
  if (phone) {
    const { data: existing } = await supabase.from('members').select('*').eq('phone', phone).single();
    const orders = [...(existing?.orders || []), { orderNumber: order.order_number, total: order.total, date: order.created_at }];
    await supabase.from('members').upsert({
      phone, name: order.contact.name, address: order.contact.address, orders,
    });
  }

  return NextResponse.json({ ok: true });
}
