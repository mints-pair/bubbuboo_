import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { orderNumber: string } }) {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const supabase = createAdminSupabase();

  // action: 'receive' (default) | 'revert-to-shipping' | 'edit-shipping' | 'delete'
  const action = body.action || 'receive';
  let logMessage = '';

  if (action === 'receive') {
    await supabase.from('orders').update({ status: 'received' }).eq('order_number', params.orderNumber);
    logMessage = `เปลี่ยนสถานะออเดอร์ ${params.orderNumber} เป็นได้รับแล้ว`;
  } else if (action === 'revert-to-shipping') {
    await supabase.from('orders').update({ status: 'shipping' }).eq('order_number', params.orderNumber);
    logMessage = `ย้อนสถานะออเดอร์ ${params.orderNumber} กลับเป็นกำลังจัดส่ง`;
  } else if (action === 'edit-shipping') {
    const { trackingNumber, carrier, date } = body;
    await supabase.from('orders').update({ shipping: { trackingNumber, carrier, date } }).eq('order_number', params.orderNumber);
    logMessage = `แก้ไขข้อมูลจัดส่งออเดอร์ ${params.orderNumber}`;
  } else if (action === 'delete') {
    await supabase.from('orders').delete().eq('order_number', params.orderNumber);
    logMessage = `ลบออเดอร์ ${params.orderNumber} ออกจากประวัติการขาย`;
  }

  if (logMessage) {
    await supabase.from('admin_logs').insert({ admin_email: user.email, message: logMessage });
  }

  return NextResponse.json({ ok: true });
}
