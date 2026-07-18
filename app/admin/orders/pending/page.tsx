'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PendingConfirmPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [slipModal, setSlipModal] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  async function load() {
    const { data } = await supabase.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    setOrders(data || []);
  }
  useEffect(() => { load(); }, []);

  async function confirm(orderNumber: string) {
    const res = await fetch(`/api/orders/${orderNumber}/confirm`, { method: 'POST' });
    if (res.ok) load(); else alert('เกิดข้อผิดพลาด');
  }

  function openReject(orderNumber: string) {
    setRejectTarget(orderNumber);
    setReason('');
    setRejectError('');
  }

  async function submitReject() {
    if (!reason.trim()) { setRejectError('กรุณาระบุสาเหตุการปฏิเสธ'); return; }
    setRejecting(true);
    const res = await fetch(`/api/orders/${rejectTarget}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    setRejecting(false);
    if (!res.ok) { const d = await res.json(); setRejectError(d.error || 'เกิดข้อผิดพลาด'); return; }
    setRejectTarget(null);
    load();
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13.5, marginBottom: 10, minWidth: 280 }}>
              <tbody>
                {o.items.map((it: any, i: number) => (
                  <tr key={i}><td>{it.name}</td><td>{it.qty}</td><td>฿{(it.price * it.qty).toLocaleString('th-TH')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>ยอดรวม (รวมค่าส่ง ฿{o.shipping_fee}): ฿{Number(o.total).toLocaleString('th-TH')}</div>
          <div>ผู้ติดต่อ: {o.contact.name} · {o.contact.phone}</div>
          <div style={{ color: '#8a8378', marginBottom: 8 }}>ที่อยู่: {o.contact.address} | X: {o.contact.xAccount}</div>
          <div style={{ marginBottom: 8 }}>รหัสติดตามที่ลูกค้าตั้ง: <b>{o.tracking_code}</b></div>
          {o.slip_image && (
            <img
              src={o.slip_image}
              onClick={() => setSlipModal(o.slip_image)}
              style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', cursor: 'zoom-in' }}
            />
          )}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => confirm(o.order_number)}>คอนเฟิร์มยอดเงิน</button>
            <button className="btn btn-outline" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }} onClick={() => openReject(o.order_number)}>ปฏิเสธออเดอร์</button>
          </div>
        </div>
      ))}

      {slipModal && (
        <div onClick={() => setSlipModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,42,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
            <img src={slipModal} style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />
            <button className="btn btn-outline" style={{ background: '#fff' }} onClick={() => setSlipModal(null)}>ปิด</button>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16 }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', margin: 0 }}>
            <h3>ปฏิเสธออเดอร์ {rejectTarget}</h3>
            <p style={{ color: '#8a8378', fontSize: 13.5 }}>
              ออเดอร์นี้จะถูกบันทึกเป็น "ยกเลิก" พร้อมสาเหตุ จะไม่มีการตัดสต็อค และเลขออเดอร์นี้จะไม่ถูกนำกลับมาใช้ซ้ำ
            </p>
            <div className="field"><label>สาเหตุการปฏิเสธ</label>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ยอดโอนไม่ตรง, สลิปไม่ชัดเจน, สั่งซื้อซ้ำ" /></div>
            {rejectError && <p style={{ color: 'var(--rose)' }}>{rejectError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ background: 'var(--rose)' }} disabled={rejecting} onClick={submitReject}>
                {rejecting ? 'กำลังบันทึก...' : 'ยืนยันการปฏิเสธ'}
              </button>
              <button className="btn btn-outline" onClick={() => setRejectTarget(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
