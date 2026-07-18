'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLang } from '@/lib/lang-context';

export default function TrackingContent() {
  const params = useSearchParams();
  const { t } = useLang();
  const [orderNumber, setOrderNumber] = useState(params.get('order') || '');
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');

  const STEPS = [
    { key: 'pending', label: t('tracking.stepPending') },
    { key: 'confirmed', label: t('tracking.stepConfirmed') },
    { key: 'shipping', label: t('tracking.stepShipping') },
    { key: 'received', label: t('tracking.stepReceived') },
  ];

  async function search() {
    setError('');
    setOrder(null);
    const res = await fetch(`/api/orders/${orderNumber}/lookup?code=${code}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setOrder(data.order);
  }

  const idx = order ? STEPS.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="container">
      <h1>{t('tracking.title')}</h1>
      <div className="card" style={{ maxWidth: 420 }}>
        <div className="field"><label>{t('tracking.orderNumberLabel')}</label>
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="PW-2607001" /></div>
        <div className="field"><label>{t('tracking.codeLabel')}</label>
          <input maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="482913" /></div>
        {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
        <button className="btn btn-primary" onClick={search}>{t('tracking.checkStatus')}</button>
      </div>

      {order && order.status === 'cancelled' ? (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{order.order_number}</div>
          <span style={{
            display: 'inline-block', fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
            background: '#F3E0DC', color: 'var(--rose)', marginBottom: 14,
          }}>{t('tracking.cancelled')}</span>
          <p style={{ fontSize: 13.5, color: '#8a8378' }}>{t('tracking.cancelledNote')}</p>
          {order.cancel_reason && (
            <div style={{ background: 'var(--paper-dim)', borderRadius: 9, padding: '10px 12px', marginTop: 10 }}>
              <b style={{ fontSize: 13 }}>{t('tracking.cancelReasonLabel')}:</b> <span style={{ fontSize: 13.5 }}>{order.cancel_reason}</span>
            </div>
          )}
        </div>
      ) : order && (
        <div className="card" style={{ maxWidth: 500 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{order.order_number}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', margin: '0 auto 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  background: i <= idx ? 'var(--jade)' : '#fff', color: i <= idx ? '#fff' : '#b5aca2',
                  border: '2px solid ' + (i <= idx ? 'var(--jade)' : 'var(--line)'),
                }}>{i < idx ? '✓' : i + 1}</div>
                <div style={{ fontSize: 11.5, color: i <= idx ? 'var(--ink)' : '#8a8378' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{t('tracking.totalLabel')}</span><span>฿{Number(order.total).toLocaleString('th-TH')}</span></div>
          {order.shipping && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{t('tracking.carrierLabel')}</span><span>{order.shipping.carrier}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{t('tracking.trackingNumberLabel')}</span><span>{order.shipping.trackingNumber}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>{t('tracking.dateLabel')}</span><span>{order.shipping.date}</span></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
