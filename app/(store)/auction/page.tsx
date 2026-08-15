'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function useCountdown(endsAt: string) {
  const [label, setLabel] = useState('');
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    function tick() {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('ปิดประมูลแล้ว'); setEnded(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 24 ? `เหลืออีก ${Math.floor(h / 24)} วัน` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      setEnded(false);
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  return { label, ended };
}

function AuctionCard({ a }: { a: any }) {
  const { label, ended } = useCountdown(a.ends_at);
  const price = a.current_bid || a.starting_price;
  return (
    <Link href={`/auction/${a.id}`} className="p-card">
      <img className="p-thumb" src={a.thumbnail_url || a.images?.[0] || ''} alt={a.name} />
      <div className="p-body">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{a.name}</div>
        <div className="p-price">฿{Number(price).toLocaleString('th-TH')}</div>
        <div style={{ fontSize: 11, color: '#8a8378', marginTop: 3 }}>
          {a.current_bid ? `${a.bidCount || 0} บิด` : 'ยังไม่มีคนบิด'}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, color: ended ? '#8a8378' : 'var(--rose)' }}>
          {label}
        </div>
      </div>
    </Link>
  );
}

export default function AuctionListPage() {
  const supabase = createClient();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from('auctions').select('*').neq('status', 'cancelled').order('ends_at', { ascending: true });
    const list = data || [];
    const { data: bids } = await supabase.from('auction_bids').select('auction_id');
    const counts: Record<string, number> = {};
    (bids || []).forEach((b: any) => { counts[b.auction_id] = (counts[b.auction_id] || 0) + 1; });
    setAuctions(list.map((a) => ({ ...a, bidCount: counts[a.id] || 0 })));
    setLoading(false);
  }

  const active = auctions.filter((a) => new Date(a.ends_at).getTime() > Date.now());
  const ended = auctions.filter((a) => new Date(a.ends_at).getTime() <= Date.now());

  return (
    <div className="container">
      <h1>ประมูล</h1>
      <p style={{ color: '#8a8378', marginTop: -6, marginBottom: 20 }}>
        ประมูลแบบเปิดเผย เห็นราคาสูงสุดตลอด ใครเสนอราคาสูงสุดตอนหมดเวลาเป็นผู้ชนะ
      </p>

      {!loading && active.length === 0 && ended.length === 0 && (
        <p style={{ color: '#9a9490' }}>ยังไม่มีรายการประมูลตอนนี้</p>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18 }}>กำลังประมูล</h2>
          <div className="grid">
            {active.map((a) => <AuctionCard key={a.id} a={a} />)}
          </div>
        </div>
      )}

      {ended.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18 }}>ปิดประมูลแล้ว</h2>
          <div className="grid">
            {ended.map((a) => <AuctionCard key={a.id} a={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
