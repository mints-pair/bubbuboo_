'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function HistoryPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [edits, setEdits] = useState<Record<string, { trackingNumber: string; carrier: string; date: string }>>({});

  async function load() {
    const { data } = await supabase.from('orders').select('*').in('status', ['shipping', 'received']).order('created_at', { ascending: false });
    setOrders(data || []);
  }
  useEffect(() => { load(); }, []);

  function editFor(o: any) {
    return edits[o.order_number] || {
      trackingNumber: o.shipping?.trackingNumber || '', carrier: o.shipping?.carrier || '', date: o.shipping?.date || '',
    };
  }

  async function markReceived(orderNumber: string) {
    await fetch(`/api/orders/${orderNumber}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'receive' }),
    });
    setUnlocked((u) => { const n = { ...u }; delete n[orderNumber]; return n; });
    load();
  }

  async function saveEdit(orderNumber: string) {
    const f = editFor(orders.find((o) => o.order_number === orderNumber));
    const merged = { ...f, ...(edits[orderNumber] || {}) };
    await fetch(`/api/orders/${orderNumber}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit-shipping', ...merged }),
    });
    load();
  }

  async function revertToShipping(orderNumber: string) {
    await fetch(`/api/orders/${orderNumber}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revert-to-shipping' }),
    });
    load();
  }

  async function deleteOrder(orderNumber: string) {
    if (!confirm(`ลบรายการ ${orderNumber} ถาวร? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    await fetch(`/api/orders/${orderNumber}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete' }),
    });
    setUnlocked((u) => { const n = { ...u }; delete n[orderNumber]; return n; });
    load();
  }

  async function submitUnlock() {
    setUnlockError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setUnlockError('ไม่พบผู้ใช้ปัจจุบัน'); return; }
    // re-verify the admin's password without ending their existing session
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) { setUnlockError('รหัสผ่านไม่ถูกต้อง'); return; }
    setUnlocked((u) => ({ ...u, [unlockTarget!]: true }));
    setUnlockTarget(null);
    setPassword('');
  }

  if (orders.length === 0) return <p>ยังไม่มีออเดอร์ที่เข้าสู่ขั้นตอนจัดส่ง</p>;

  return (
    <div>
      {orders.map((o) => {
        const locked = o.status === 'received' && !unlocked[o.order_number];
        const f = editFor(o);
        return (
          <div key={o.order_number} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{o.order_number}</b>
              <span>{o.status === 'received' ? 'ได้รับสินค้าแล้ว' : 'กำลังจัดส่ง'} {locked ? '· ล็อคแล้ว' : ''}</span>
            </div>
            <div style={{ color: '#8a8378', marginBottom: 8 }}>ส่งถึง: {o.contact.name} — {o.contact.address} · {o.contact.phone}</div>
            <div style={{ marginBottom: 10 }}>ยอดรวม: ฿{Number(o.total).toLocaleString('th-TH')}</div>

            {locked ? (
              <>
                <div style={{ color: '#8a8378', marginBottom: 10 }}>
                  เลขพัสดุ {o.shipping?.trackingNumber || '-'} · {o.shipping?.carrier || '-'} · {o.shipping?.date || '-'}
                </div>
                <p style={{ color: '#8a8378' }}>ออเดอร์นี้ได้รับสินค้าแล้ว และถูกล็อคไม่ให้แก้ไข ต้องใส่รหัสผ่านเพื่อปลดล็อค</p>
                <button className="btn btn-outline" onClick={() => setUnlockTarget(o.order_number)}>ใส่รหัสเพื่อแก้ไข</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}><label>เลขพัสดุ</label>
                    <input value={f.trackingNumber} onChange={(e) => setEdits({ ...edits, [o.order_number]: { ...f, trackingNumber: e.target.value } })} /></div>
                  <div className="field" style={{ flex: 1 }}><label>บริการขนส่ง</label>
                    <input value={f.carrier} onChange={(e) => setEdits({ ...edits, [o.order_number]: { ...f, carrier: e.target.value } })} /></div>
                  <div className="field" style={{ flex: 1 }}><label>วันที่จัดส่ง</label>
                    <input type="date" value={f.date} onChange={(e) => setEdits({ ...edits, [o.order_number]: { ...f, date: e.target.value } })} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {o.status === 'shipping' ? (
                    <>
                      <button className="btn btn-outline" onClick={() => saveEdit(o.order_number)}>บันทึกข้อมูลจัดส่ง</button>
                      <button className="btn btn-primary" onClick={() => markReceived(o.order_number)}>ลูกค้าได้รับแล้ว →</button>
                      <button className="btn btn-outline" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }}
                        onClick={() => deleteOrder(o.order_number)}>ลบรายการนี้</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-outline" onClick={() => saveEdit(o.order_number)}>บันทึกการแก้ไข</button>
                      <button className="btn btn-outline" onClick={() => revertToShipping(o.order_number)}>ย้อนกลับเป็นกำลังจัดส่ง</button>
                      <button className="btn btn-outline" style={{ color: 'var(--rose)' }}
                        onClick={() => setUnlocked((u) => { const n = { ...u }; delete n[o.order_number]; return n; })}>ล็อคอีกครั้ง</button>
                      <button className="btn btn-outline" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }}
                        onClick={() => deleteOrder(o.order_number)}>ลบรายการนี้</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {unlockTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: 360, width: '100%' }}>
            <h3>ปลดล็อคออเดอร์ {unlockTarget}</h3>
            <p>กรุณาใส่รหัสผ่านเข้าสู่ระบบหลังบ้านอีกครั้งเพื่อแก้ไข</p>
            <div className="field"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {unlockError && <p style={{ color: 'var(--rose)' }}>{unlockError}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={submitUnlock}>ปลดล็อค</button>
            <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => { setUnlockTarget(null); setPassword(''); setUnlockError(''); }}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  );
}
