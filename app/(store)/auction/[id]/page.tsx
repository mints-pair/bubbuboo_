'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getBidSessionId, getSavedBidderInfo, saveBidderInfo } from '@/lib/auctionSession';
import { useLang } from '@/lib/lang-context';

function maskName(name: string) {
  if (!name) return '***';
  if (name.length <= 2) return name[0] + '*';
  return name.slice(0, 2) + '*'.repeat(Math.max(2, name.length - 2));
}

export default function AuctionDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { t } = useLang();
  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [bidAmount, setBidAmount] = useState('');
  const [bidderName, setBidderName] = useState('');
  const [bidderContact, setBidderContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const saved = getSavedBidderInfo();
    if (saved) { setBidderName(saved.name); setBidderContact(saved.contact); }
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [params.id]);

  async function load() {
    const { data: a } = await supabase.from('auctions').select('*').eq('id', params.id).single();
    setAuction(a);
    const { data: b } = await supabase.from('auction_bids').select('*').eq('auction_id', params.id).order('created_at', { ascending: false }).limit(30);
    setBids(b || []);
    setLoading(false);

    if (a) {
      const isEnded = new Date(a.ends_at).getTime() <= Date.now();
      if (isEnded && a.status === 'active' && a.current_bid && !a.end_notified) {
        fetch(`/api/auctions/${params.id}/notify-ended`, { method: 'POST' }).catch(() => {});
      }
    }
  }

  if (loading) return <div className="container" />;
  if (!auction) return <div className="container">{t('auction.notFound')}</div>;

  const ended = new Date(auction.ends_at).getTime() <= now || auction.status !== 'active';
  const alreadyPaid = auction.status === 'completed';
  const minNext = auction.current_bid ? Number(auction.current_bid) + Number(auction.min_increment) : Number(auction.starting_price);
  const sessionId = typeof window !== 'undefined' ? getBidSessionId() : '';
  const isWinner = ended && auction.current_bidder_session_id === sessionId && auction.current_bid;

  async function submitBid() {
    setError('');
    const amount = Number(bidAmount);
    if (!amount || amount < minNext) { setError(t('auction.errorMinBid', { n: minNext.toLocaleString('th-TH') })); return; }
    if (!bidderName.trim() || !bidderContact.trim()) { setError(t('auction.errorFillAll')); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auctions/${params.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, name: bidderName, contact: bidderContact, sessionId: getBidSessionId() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('auction.errorGeneric')); await load(); return; }
      saveBidderInfo({ name: bidderName, contact: bidderContact });
      setBidAmount('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await load();
    } catch {
      setError(t('auction.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  const imgs = auction.images?.length ? auction.images : [''];

  return (
    <div className="container">
      <Link href="/auction" style={{ display: 'inline-block', marginBottom: 14, color: 'var(--jade)', fontSize: 13.5, fontWeight: 600 }}>{t('auction.back')}</Link>
      <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
          <img src={imgs[selectedImgIdx]} alt={auction.name} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 14, background: 'var(--paper-dim)' }} />
          {imgs.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {imgs.map((im: string, i: number) => (
                <img key={i} src={im} onClick={() => setSelectedImgIdx(i)} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: i === selectedImgIdx ? '2px solid var(--jade)' : '2px solid transparent' }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>{auction.name}</h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#5a5257' }}>{auction.description}</p>
          <div style={{ fontSize: 13, color: '#7d7570', marginBottom: 14 }}>{t('auction.shippingFee')} ฿{Number(auction.shipping_fee).toLocaleString('th-TH')}</div>

          <div className="card">
            <div style={{ fontSize: 12.5, color: '#8a8378', marginBottom: 4 }}>{auction.current_bid ? t('auction.currentBid') : t('auction.startingPrice')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--rose)' }}>
              ฿{Number(auction.current_bid || auction.starting_price).toLocaleString('th-TH')}
            </div>
            {auction.current_bid && (
              <div style={{ fontSize: 12.5, color: '#8a8378', marginTop: 2 }}>{t('auction.leadingBidder', { name: maskName(auction.current_bidder_name) })}</div>
            )}

            {!ended ? (
              <>
                <div style={{
                  marginTop: 14, padding: '8px 12px', borderRadius: 9, background: 'var(--marigold)', color: 'var(--ink)',
                  fontWeight: 700, fontSize: 13.5, textAlign: 'center',
                }}>
                  <AuctionCountdown endsAt={auction.ends_at} t={t} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="field"><label>{t('auction.bidAmountLabel', { n: minNext.toLocaleString('th-TH') })}</label>
                    <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder={String(minNext)} /></div>
                  <div className="field"><label>{t('auction.yourName')}</label>
                    <input value={bidderName} onChange={(e) => setBidderName(e.target.value)} /></div>
                  <div className="field"><label>{t('auction.yourContact')}</label>
                    <input value={bidderContact} onChange={(e) => setBidderContact(e.target.value)} placeholder={t('auction.contactPlaceholder')} /></div>
                  {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
                  {success && <p style={{ color: 'var(--jade)', fontWeight: 600 }}>{t('auction.bidSuccess')}</p>}
                  <button className="btn btn-primary" disabled={submitting} onClick={submitBid}>
                    {submitting ? t('auction.placingBid') : t('auction.placeBid')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 14 }}>
                <div style={{ padding: '8px 12px', borderRadius: 9, background: '#EDEAE4', color: '#8a8378', fontWeight: 700, fontSize: 13.5, textAlign: 'center' }}>
                  {t('auction.closedLabel')}
                </div>
                {isWinner && !alreadyPaid && (
                  <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <p style={{ color: 'var(--jade)', fontWeight: 700, marginBottom: 10 }}>{t('auction.youWon')}</p>
                    <Link href={`/auction/${auction.id}/checkout`} className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>{t('auction.goToPay')}</Link>
                  </div>
                )}
                {isWinner && alreadyPaid && (
                  <p style={{ color: 'var(--jade)', fontWeight: 600, marginTop: 10, textAlign: 'center' }}>{t('auction.alreadyPaid')}</p>
                )}
              </div>
            )}
          </div>

          {bids.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>{t('auction.bidHistory', { n: bids.length })}</h3>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {bids.map((b) => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
                    <span>{maskName(b.bidder_name)}</span>
                    <span style={{ fontWeight: 600 }}>฿{Number(b.amount).toLocaleString('th-TH')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuctionCountdown({ endsAt, t }: { endsAt: string; t: (key: string, vars?: any) => string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function tick() {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel(t('auction.timeUp')); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const hms = h > 24 ? t('auction.timeLeftDays', { n: Math.floor(h / 24) }) : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      setLabel(h > 24 ? hms : t('auction.timeLeftLabel', { hms }));
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return <>{label}</>;
}
