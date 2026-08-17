'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isThailandPost } from '@/lib/courierLinks';

export default function PendingShipPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<string, { trackingNumber: string; carrier: string; date: string; trackingUrl: string }>>({});

  async function load() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'confirmed').order('created_at', { ascending: true });
    setOrders(data || []);
  }
  useEffect(() => { load(); }, []);

  function formFor(orderNumber: string) {
    return forms[orderNumber] || { trackingNumber: '', carrier: '', date: new Date().toISOString().slice(0, 10), trackingUrl: '' };
  }

  async function saveShipping(orderNumber: string) {
    const f = formFor(orderNumber);
    if (!f.trackingNumber || !f.carrier) { alert('กรุณากรอกเลขพัสดุและบริการขนส่ง'); return; }
    const res = await fetch(`/api/orders/${orderNumber}/ship`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    if (res.ok) load(); else alert('เกิดข้อผิดพลาด');
  }

  async function exportExcel() {
    if (orders.length === 0) return;
    const XLSX = await import('xlsx');
    const rows = orders.map((o) => ({
      'เลขออเดอร์': o.order_number,
      'ชื่อผู้รับ': o.contact.name,
      'ที่อยู่': o.contact.address,
      'เบอร์โทร': o.contact.phone,
      'บัญชี X': o.contact.xAccount || '',
      'ยอดรวม': o.total,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รอการจัดส่ง');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `รอการจัดส่ง-${dateStr}.xlsx`);
  }

  if (orders.length === 0) return <p>ไม่มีคำสั่งซื้อที่รอจัดส่ง</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <p style={{ color: '#8a8378', margin: 0 }}>เมื่อบันทึกแล้ว ออเดอร์จะย้ายไปอยู่ในแท็บ "ประวัติการขายทั้งหมด" โดยอัตโนมัติ</p>
        <button className="btn btn-outline" onClick={exportExcel}>Export Excel</button>
      </div>
      {orders.map((o) => {
        const f = formFor(o.order_number);
        return (
          <div key={o.order_number} className="card" style={{ marginTop: 16 }}>
            <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{o.order_number}</b>
            <div style={{ color: '#8a8378', margin: '8px 0' }}>ส่งถึง: {o.contact.name} — {o.contact.address} · {o.contact.phone}</div>

            <div style={{ background: 'var(--paper-dim)', borderRadius: 9, padding: '10px 12px', marginBottom: 14 }}>
              {o.items.map((it: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < o.items.length - 1 ? '1px dashed var(--line)' : 'none' }}>
                  <img src={it.image || ''} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 7, background: '#fff', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: '#8a8378' }}>จำนวน {it.qty} ชิ้น</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="field-row">
              <div className="field" style={{ flex: 1 }}><label>เลขพัสดุ</label>
                <input value={f.trackingNumber} onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, trackingNumber: e.target.value } })} /></div>
              <div className="field" style={{ flex: 1 }}><label>บริการขนส่ง</label>
                <input value={f.carrier} onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, carrier: e.target.value } })} /></div>
              <div className="field" style={{ flex: 1 }}><label>วันที่จัดส่ง</label>
                <input type="date" value={f.date} onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, date: e.target.value } })} /></div>
            </div>
            {isThailandPost(f.carrier) ? (
              <p style={{ fontSize: 12.5, color: 'var(--jade)', marginTop: -8, marginBottom: 14 }}>
                ✓ ระบบจะสร้างลิงก์ติดตามพัสดุของไปรษณีย์ไทยให้อัตโนมัติ ไม่ต้องแนบลิงก์เอง
              </p>
            ) : (
              <div className="field">
                <label>ลิงก์ติดตามพัสดุ (ไม่บังคับ)</label>
                <input
                  value={f.trackingUrl}
                  onChange={(e) => setForms({ ...forms, [o.order_number]: { ...f, trackingUrl: e.target.value } })}
                  placeholder="วางลิงก์จากเว็บขนส่งที่กรอกเลขพัสดุไว้แล้ว เช่น https://..."
                />
                <p style={{ fontSize: 12, color: '#8a8378', marginTop: 4 }}>ถ้าใส่ไว้ ลูกค้าจะเห็นปุ่มกดตรงไปหน้านั้นได้เลยที่หน้า Tracking</p>
              </div>
            )}
            <button className="btn btn-primary" onClick={() => saveShipping(o.order_number)}>บันทึก &amp; เปลี่ยนสถานะเป็นกำลังจัดส่ง</button>
          </div>
        );
      })}
    </div>
  );
}
