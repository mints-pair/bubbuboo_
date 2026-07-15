import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function GET(req: Request, { params }: { params: { orderNumber: string } }) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') || '';

  const supabase = createAdminSupabase();
  const { data: order } = await supabase
    .from('orders')
    .select('order_number, status, items, total, shipping')
    .eq('order_number', params.orderNumber)
    .single();

  if (!order || order.status === undefined) {
    return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อ หรือรหัสติดตามไม่ถูกต้อง' }, { status: 404 });
  }

  // re-fetch tracking_code separately so it's never sent to the client
  const { data: full } = await supabase.from('orders').select('tracking_code').eq('order_number', params.orderNumber).single();
  if (!full || full.tracking_code !== code) {
    return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อ หรือรหัสติดตามไม่ถูกต้อง' }, { status: 404 });
  }

  return NextResponse.json({ order });
}
