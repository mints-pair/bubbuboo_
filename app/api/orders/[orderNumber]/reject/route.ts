import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { orderNumber: string } }) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { reason } = await req.json().catch(() => ({ reason: '' }));
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุสาเหตุการปฏิเสธ' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data: order } = await supabase.from('orders').select('*').eq('order_number', params.orderNumber).single();
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'ออเดอร์นี้ถูกดำเนินการไปแล้ว' }, { status: 400 });
  }

  // Note: stock is never touched here — pending orders never had stock
  // deducted in the first place (only a "hold" that releases automatically
  // once status is no longer 'pending'). The order number itself is never
  // reused, since it was already assigned atomically when the order was
  // created and the monthly counter never decrements.
  await supabase.from('orders').update({
    status: 'cancelled',
    cancel_reason: reason.trim(),
  }).eq('order_number', params.orderNumber);

  await supabase.from('admin_logs').insert({
    admin_email: user.email,
    message: `ปฏิเสธออเดอร์ ${params.orderNumber} (เหตุผล: ${reason.trim()})`,
  });

  return NextResponse.json({ ok: true });
}
