'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CancelledOrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('orders').select('*').eq('status', 'cancelled').order('created_at', { ascending: false })
      .then(({ data }) => { setOrders(data || []); setLoading(false); });
  }, []);

  if (loading) return null;
  if (orders.length === 0) return <p>ยังไม่มีออเดอร์ที่ถูกปฏิเสธ</p>;

  return (
    <div>
      {orders.map((o) => (
        <div key={o.order_number} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{o.order_number}</b>
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: '#F3E0DC', color: 'var(--rose)' }}>ถูกปฏิเสธ</span>
          </div>
          <div style={{ color: '#8a8378', marginBottom: 8 }}>ลูกค้า: {o.contact?.name} · {o.contact?.phone}</div>
          <div style={{ marginBottom: 8 }}>ยอดรวม: ฿{Number(o.total).toLocaleString('th-TH')}</div>
          <div style={{ background: 'var(--paper-dim)', borderRadius: 9, padding: '10px 12px' }}>
            <b style={{ fontSize: 13 }}>สาเหตุ:</b> <span style={{ fontSize: 13.5 }}>{o.cancel_reason || '-'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
