'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PendingShipPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<string, { trackingNumber: string; carrier: string; date: string }>>({});

  async function load() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'confirmed').order('created_at', { ascending: true });
    setOrders(data || []);
  }
  useEffect(() => { load(); }, []);

  function formFor(orderNumber: string) {
    return forms[orderNumber] || { trackingNumber: '', carrier: '', date: new Date().toISOString().slice(0, 10) };
  }

  async function saveShipping(orderNumber: string) {
    const f = formFor(orderNumber);
    if (!f.trackingNumber || !f.carrier) { alert('กรุณากรอกเลขพัสดุและบริการขนส่ง'); return; }
    const res = await fetch(`/api/orders/${orderNumber}/ship`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    if (res.ok) load(); else alert('เกิดข้อผิดพลาด');
  }

  if (orders.length === 0) return <p>ไม่มีคำสั่งซื้อที่รอจัดส่ง</p>;

  return (
    <div>
      <p style={{ color: '#8a8378', marginTop: -6 }}>เมื่อบันทึกแล้ว ออเดอร์จะย้ายไปอยู่ในแท็บ "ประวัติการขายทั้งหมด" โดยอัตโนมัติ</p>
      {orders.map((o) => {
        const f = formFor(o.order_number);
        return (
          <div key={o.order_number} className="card">
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{o.order_number}</b>
            <div style={{ color: '#8a8378', margin: '8px 0' }}>ส่งถึง: {o.contact.name} — {o.contact.address} · {o.contact.phone}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1 }}><label>เลขพัสดุ</label>
                <input value={f.trackingNumber} onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, trackingNumber: e.target.value } })} /></div>
              <div className="field" style={{ flex: 1 }}><label>บริการขนส่ง</label>
                <input value={f.carrier} onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, carrier: e.target.value } })} /></div>
              <div className="field" style={{ flex: 1 }}><label>วันที่จัดส่ง</label>
                <input type="date" value={f.date} onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, date: e.target.value } })} /></div>
            </div>
            <button className="btn btn-primary" onClick={() => saveShipping(o.order_number)}>บันทึก &amp; เปลี่ยนสถานะเป็นกำลังจัดส่ง</button>
          </div>
        );
      })}
    </div>
  );
}
