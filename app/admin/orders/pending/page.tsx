'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PendingConfirmPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    setOrders(data || []);
  }
  useEffect(() => { load(); }, []);

  async function confirm(orderNumber: string) {
    const res = await fetch(`/api/orders/${orderNumber}/confirm`, { method: 'POST' });
    if (res.ok) load(); else alert('เกิดข้อผิดพลาด');
  }

  if (orders.length === 0) return <p>ไม่มีคำสั่งซื้อที่รอการคอนเฟิร์ม</p>;

  return (
    <div>
      {orders.map((o) => (
        <div key={o.order_number} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{o.order_number}</b>
            <span>รอตรวจสอบสลิป</span>
          </div>
          <table style={{ width: '100%', fontSize: 13.5, marginBottom: 10 }}>
            <tbody>
              {o.items.map((it: any, i: number) => (
                <tr key={i}><td>{it.name}</td><td>{it.qty}</td><td>฿{(it.price * it.qty).toLocaleString('th-TH')}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>ยอดรวม (รวมค่าส่ง ฿{o.shipping_fee}): ฿{Number(o.total).toLocaleString('th-TH')}</div>
          <div>ผู้ติดต่อ: {o.contact.name} · {o.contact.phone}</div>
          <div style={{ color: '#8a8378', marginBottom: 8 }}>ที่อยู่: {o.contact.address} | X: {o.contact.xAccount}</div>
          <div style={{ marginBottom: 8 }}>รหัสติดตามที่ลูกค้าตั้ง: <b>{o.tracking_code}</b></div>
          {o.slip_image && <img src={o.slip_image} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => confirm(o.order_number)}>คอนเฟิร์มยอดเงิน</button>
          </div>
        </div>
      ))}
    </div>
  );
}
