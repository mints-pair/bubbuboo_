import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { sendAdminTelegramMessage } from '@/lib/telegram';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();
  const { data: auction } = await supabase.from('auctions').select('*').eq('id', params.id).single();
  if (!auction) return NextResponse.json({ ok: false });

  const ended = new Date(auction.ends_at).getTime() <= Date.now();
  if (!ended || auction.status !== 'active' || !auction.current_bid || auction.end_notified) {
    return NextResponse.json({ ok: false });
  }

  // atomic claim so concurrent viewers can't both fire the alert
  const { data: claimed } = await supabase
    .from('auctions')
    .update({ end_notified: true })
    .eq('id', params.id)
    .eq('end_notified', false)
    .select()
    .single();

  if (!claimed) return NextResponse.json({ ok: false });

  await sendAdminTelegramMessage(
    `ปิดประมูลแล้ว รอผู้ชนะชำระเงิน\nรายการ: ${auction.name}\nราคาปิด: ฿${Number(auction.current_bid).toLocaleString('th-TH')}\nผู้ชนะ: ${auction.current_bidder_name} (${auction.current_bidder_contact})`
  );

  return NextResponse.json({ ok: true });
}
