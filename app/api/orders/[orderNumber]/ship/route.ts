import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { orderNumber: string } }) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { trackingNumber, carrier, date } = await req.json();
  if (!trackingNumber || !carrier) return NextResponse.json({ error: 'กรอกข้อมูลให้ครบ' }, { status: 400 });

  const supabase = createAdminSupabase();
  await supabase.from('orders').update({
    status: 'shipping',
    shipping: { trackingNumber, carrier, date },
  }).eq('order_number', params.orderNumber);

  await supabase.from('admin_logs').insert({
    admin_email: user.email,
    message: `บันทึกข้อมูลจัดส่งออเดอร์ ${params.orderNumber} (เลขพัสดุ ${trackingNumber}, ${carrier})`,
  });

  return NextResponse.json({ ok: true });
}
