'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

const STEPS = [
  { key: 'pending', label: 'รอตรวจสอบ' },
  { key: 'confirmed', label: 'ยืนยันแล้ว' },
  { key: 'shipping', label: 'กำลังจัดส่ง' },
  { key: 'received', label: 'ได้รับแล้ว' },
];

export default function TrackingContent() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') || '');
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState('');

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
      <h1>ติดตามคำสั่งซื้อ</h1>
      <div className="card" style={{ maxWidth: 420 }}>
        <div className="field"><label>เลขออเดอร์</label>
          <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="PW-2607001" /></div>
        <div className="field"><label>รหัสติดตาม 6 หลัก</label>
          <input maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="482913" /></div>
        {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
        <button className="btn btn-primary" onClick={search}>ตรวจสอบสถานะ</button>
      </div>

      {order && (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>ยอดรวม</span><span>฿{Number(order.total).toLocaleString('th-TH')}</span></div>
          {order.shipping && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>บริการขนส่ง</span><span>{order.shipping.carrier}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>เลขพัสดุ</span><span>{order.shipping.trackingNumber}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>วันที่จัดส่ง</span><span>{order.shipping.date}</span></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
