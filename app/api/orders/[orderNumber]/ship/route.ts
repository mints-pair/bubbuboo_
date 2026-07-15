import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { orderNumber: string } }) {
  const authed = createServerSupabase();
  const { data: { session } } = await authed.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { trackingNumber, carrier, date } = await req.json();
  if (!trackingNumber || !carrier) return NextResponse.json({ error: 'กรอกข้อมูลให้ครบ' }, { status: 400 });

  const supabase = createAdminSupabase();
  await supabase.from('orders').update({
    status: 'shipping',
    shipping: { trackingNumber, carrier, date },
  }).eq('order_number', params.orderNumber);

  return NextResponse.json({ ok: true });
}
