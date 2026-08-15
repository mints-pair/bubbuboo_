import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { amount, name, contact, sessionId } = await req.json().catch(() => ({}));

  if (!amount || !name?.trim() || !contact?.trim() || !sessionId) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data: auction } = await supabase.from('auctions').select('*').eq('id', params.id).single();
  if (!auction) return NextResponse.json({ error: 'ไม่พบรายการประมูลนี้' }, { status: 404 });
  if (auction.status !== 'active') return NextResponse.json({ error: 'ประมูลนี้ปิดไปแล้ว' }, { status: 400 });
  if (new Date(auction.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'หมดเวลาประมูลแล้ว' }, { status: 400 });
  }

  const minNext = auction.current_bid ? Number(auction.current_bid) + Number(auction.min_increment) : Number(auction.starting_price);
  if (amount < minNext) {
    return NextResponse.json({ error: `ราคาต้องอย่างน้อย ฿${minNext.toLocaleString('th-TH')}`, minNext }, { status: 400 });
  }

  // Atomic, race-safe update: only succeeds if this bid is still the highest
  // at the moment the write happens — if someone else's bid landed a moment
  // earlier, this UPDATE simply matches zero rows instead of overwriting it.
  let query = supabase
    .from('auctions')
    .update({
      current_bid: amount,
      current_bidder_name: name.trim(),
      current_bidder_contact: contact.trim(),
      current_bidder_session_id: sessionId,
    })
    .eq('id', params.id)
    .eq('status', 'active')
    .gt('ends_at', new Date().toISOString());

  query = auction.current_bid
    ? query.lt('current_bid', amount)
    : query.is('current_bid', null);

  const { data: updated, error } = await query.select().single();

  if (error || !updated) {
    return NextResponse.json({ error: 'มีคนบิดไปก่อนคุณแล้ว กรุณารีเฟรชแล้วลองใหม่', outbid: true }, { status: 409 });
  }

  await supabase.from('auction_bids').insert({
    auction_id: params.id,
    bidder_name: name.trim(),
    bidder_contact: contact.trim(),
    bidder_session_id: sessionId,
    amount,
  });

  return NextResponse.json({ ok: true, currentBid: amount });
}
