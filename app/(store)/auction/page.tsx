'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/lang-context';

function useCountdown(endsAt: string, t: (key: string, vars?: any) => string) {
  const [label, setLabel] = useState('');
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    function tick() {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel(t('auction.closedLabel')); setEnded(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 24 ? t('auction.timeLeftDays', { n: Math.floor(h / 24) }) : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      setEnded(false);
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return { label, ended };
}

function AuctionCard({ a, t }: { a: any; t: (key: string, vars?: any) => string }) {
  const { label, ended } = useCountdown(a.ends_at, t);
  const price = a.current_bid || a.starting_price;
  return (
    <Link href={`/auction/${a.id}`} className="p-card">
      <img className="p-thumb" src={a.thumbnail_url || a.images?.[0] || ''} alt={a.name} />
      <div className="p-body">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5, minHeight: 38 }}>{a.name}</div>
        <div className="p-price">฿{Number(price).toLocaleString('th-TH')}</div>
        <div style={{ fontSize: 11, color: '#8a8378', marginTop: 3 }}>
          {a.current_bid ? t('auction.bidsCount', { n: a.bidCount || 0 }) : t('auction.noBidsYet')}
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
  const { t } = useLang();
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
    const withCounts = list.map((a) => ({ ...a, bidCount: counts[a.id] || 0 }));

    // hide from the public list once fully wrapped up:
    // - already paid (nothing left to do here)
    // - ended with zero bids (nothing interesting to show)
    // Still SHOWN: ended-with-a-winner-but-unpaid, so the winner can find
    // their way back to the payment link.
    const visible = withCounts.filter((a) => {
      if (a.status === 'completed') return false;
      const isEnded = new Date(a.ends_at).getTime() <= Date.now();
      if (isEnded && !a.current_bid) return false;
      return true;
    });

    setAuctions(visible);

    // opportunistically nudge the "ended, winner pending payment" alert for
    // any auction that just crossed its end time — harmless if it fires
    // more than once, the API route itself guards against duplicate sends
    for (const a of withCounts) {
      const isEnded = new Date(a.ends_at).getTime() <= Date.now();
      if (isEnded && a.status === 'active' && a.current_bid && !a.end_notified) {
        fetch(`/api/auctions/${a.id}/notify-ended`, { method: 'POST' }).catch(() => {});
      }
    }

    setLoading(false);
  }

  const active = auctions.filter((a) => new Date(a.ends_at).getTime() > Date.now());
  const ended = auctions.filter((a) => new Date(a.ends_at).getTime() <= Date.now());

  return (
    <div className="container">
      <h1>{t('auction.title')}</h1>
      <p style={{ color: '#8a8378', marginTop: -6, marginBottom: 20 }}>
        {t('auction.subtitle')}
      </p>

      {!loading && active.length === 0 && ended.length === 0 && (
        <p style={{ color: '#9a9490' }}>{t('auction.empty')}</p>
      )}

      {active.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18 }}>{t('auction.active')}</h2>
          <div className="grid">
            {active.map((a) => <AuctionCard key={a.id} a={a} t={t} />)}
          </div>
        </div>
      )}

      {ended.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18 }}>{t('auction.ended')}</h2>
          <div className="grid">
            {ended.map((a) => <AuctionCard key={a.id} a={a} t={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}
