'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { compressImageFile, compressImage } from '@/lib/imageCompress';

const emptyDraft = { name: '', description: '', startingPrice: '', minIncrement: '10', shippingFee: '', endsAt: '', images: [] as string[], eventId: '' };

function toLocalInputValue(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminAuctionsPage() {
  const supabase = createClient();
  const [auctions, setAuctions] = useState<any[]>([]);
  const [bidCounts, setBidCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bidHistory, setBidHistory] = useState<any[]>([]);
  const formRef = useRef<HTMLDivElement>(null);
  const [pickerProducts, setPickerProducts] = useState<any[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [eventOptions, setEventOptions] = useState<any[]>([]);
  const [closeTarget, setCloseTarget] = useState<any>(null);
  const [closeForm, setCloseForm] = useState({ xAccount: '', name: '', address: '', phone: '', trackingCode: '', paymentMethod: 'qr' as 'qr' | 'wise' | 'truewallet', note: '' });
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'event').order('name', { ascending: true })
      .then(({ data }) => setEventOptions(data || []));
  }, []);

  async function load() {
    const { data } = await supabase.from('auctions').select('*').order('created_at', { ascending: false });
    setAuctions(data || []);
    const { data: bids } = await supabase.from('auction_bids').select('auction_id');
    const counts: Record<string, number> = {};
    (bids || []).forEach((b: any) => { counts[b.auction_id] = (counts[b.auction_id] || 0) + 1; });
    setBidCounts(counts);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    supabase.from('products').select('*').eq('is_giveaway', false).order('name', { ascending: true })
      .then(({ data }) => setPickerProducts(data || []));
  }, []);

  function pickProduct(p: any) {
    setDraft((d) => ({
      ...d,
      name: p.name,
      description: p.description || '',
      shippingFee: String(p.shipping_fee || ''),
      images: p.images || [],
      eventId: p.event_id || '',
    }));
    setShowPicker(false);
    setPickerQuery('');
  }

  const filteredPickerProducts = pickerQuery.trim()
    ? pickerProducts.filter((p) => p.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
    : pickerProducts;

  async function uploadFiles(files: FileList) {
    setUploading(true);
    const urls: string[] = [];
    for (const rawFile of Array.from(files)) {
      const file = await compressImageFile(rawFile, { maxDim: 1200, quality: 0.8 });
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from('shop-images').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setDraft((d) => ({ ...d, images: [...d.images, ...urls] }));
    setUploading(false);
  }

  async function saveAuction() {
    if (!draft.name || !draft.startingPrice || !draft.endsAt) { alert('กรุณากรอกชื่อ ราคาเริ่มต้น และวัน-เวลาปิดประมูล'); return; }
    setSaving(true);

    let thumbnailUrl: string | null = null;
    if (draft.images.length > 0) {
      try {
        const res = await fetch(draft.images[0]);
        const blob = await res.blob();
        const thumbBlob = await compressImage(blob, { maxDim: 320, quality: 0.7 });
        const path = `products/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from('shop-images').upload(path, thumbBlob);
        if (!error) {
          const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
          thumbnailUrl = data.publicUrl;
        }
      } catch {}
    }

    const payload: any = {
      name: draft.name,
      description: draft.description,
      starting_price: Number(draft.startingPrice) || 0,
      min_increment: Number(draft.minIncrement) || 10,
      shipping_fee: Number(draft.shippingFee) || 0,
      ends_at: new Date(draft.endsAt).toISOString(),
      images: draft.images,
      event_id: draft.eventId || null,
    };
    if (thumbnailUrl) payload.thumbnail_url = thumbnailUrl;

    if (editingId) {
      await supabase.from('auctions').update(payload).eq('id', editingId);
      logAdminAction(`แก้ไขรายการประมูล "${payload.name}"`);
    } else {
      await supabase.from('auctions').insert(payload);
      logAdminAction(`สร้างรายการประมูลใหม่ "${payload.name}"`);
    }
    setDraft(emptyDraft);
    setEditingId(null);
    setSaving(false);
    load();
  }

  function startEdit(a: any) {
    setEditingId(a.id);
    setDraft({
      name: a.name, description: a.description || '', startingPrice: String(a.starting_price),
      minIncrement: String(a.min_increment), shippingFee: String(a.shipping_fee),
      endsAt: toLocalInputValue(a.ends_at), images: a.images || [], eventId: a.event_id || '',
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openCloseModal(a: any) {
    setCloseTarget(a);
    setCloseForm({ xAccount: '', name: a.current_bidder_name || '', address: '', phone: a.current_bidder_contact || '', trackingCode: '', paymentMethod: 'qr', note: '' });
    setCloseError('');
  }

  async function submitAdminClose() {
    if (!closeTarget) return;
    if (!closeForm.xAccount || !closeForm.name || !closeForm.address || !closeForm.phone) { setCloseError('กรุณากรอกข้อมูลติดต่อ+ที่อยู่ให้ครบ'); return; }
    if (!/^\d{6}$/.test(closeForm.trackingCode)) { setCloseError('รหัสติดตามต้องเป็นตัวเลข 6 หลัก'); return; }
    setClosing(true);
    setCloseError('');
    try {
      const res = await fetch(`/api/auctions/${closeTarget.id}/admin-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: { xAccount: closeForm.xAccount, name: closeForm.name, address: closeForm.address, phone: closeForm.phone },
          trackingCode: closeForm.trackingCode, paymentMethod: closeForm.paymentMethod, note: closeForm.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCloseError(data.error || 'เกิดข้อผิดพลาด'); return; }
      logAdminAction(`ปิดประมูล "${closeTarget.name}" ด้วยตนเอง → ออเดอร์ ${data.orderNumber}`);
      alert(`ปิดประมูลสำเร็จ — สร้างออเดอร์ ${data.orderNumber} แล้ว (สถานะ: รอจัดส่ง)`);
      setCloseTarget(null);
      load();
    } catch (e: any) {
      setCloseError(e.message || 'เกิดข้อผิดพลาด');
    } finally {
      setClosing(false);
    }
  }

  async function cancelAuction(a: any) {
    if (!confirm(`ยกเลิกรายการประมูล "${a.name}"? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    await supabase.from('auctions').update({ status: 'cancelled' }).eq('id', a.id);
    logAdminAction(`ยกเลิกรายการประมูล "${a.name}"`);
    load();
  }

  async function deleteAuction(a: any) {
    const warning = a.order_number
      ? `ลบรายการประมูล "${a.name}" ถาวร? (ออเดอร์ ${a.order_number} ที่เกิดจากการประมูลนี้จะยังอยู่ในระบบตามปกติ ไม่ถูกลบไปด้วย) การกระทำนี้ย้อนกลับไม่ได้`
      : `ลบรายการประมูล "${a.name}" ถาวร? ประวัติการบิดทั้งหมดจะถูกลบไปด้วย การกระทำนี้ย้อนกลับไม่ได้`;
    if (!confirm(warning)) return;
    await supabase.from('auctions').delete().eq('id', a.id);
    logAdminAction(`ลบรายการประมูล "${a.name}"`);
    load();
  }

  async function toggleHistory(a: any) {
    if (expandedId === a.id) { setExpandedId(null); return; }
    setExpandedId(a.id);
    const { data } = await supabase.from('auction_bids').select('*').eq('auction_id', a.id).order('created_at', { ascending: false });
    setBidHistory(data || []);
  }

  function statusLabel(a: any) {
    const ended = new Date(a.ends_at).getTime() <= Date.now();
    if (a.status === 'cancelled') return { text: 'ยกเลิกแล้ว', color: '#8a8378', bg: '#EDEAE4' };
    if (a.status === 'completed') return { text: 'ชำระเงินแล้ว', color: 'var(--jade)', bg: 'var(--jade-light)' };
    if (ended) return { text: 'ปิดประมูล รอผู้ชนะจ่ายเงิน', color: 'var(--rose)', bg: '#F3E0DC' };
    return { text: 'กำลังประมูล', color: '#8A6A2F', bg: '#F3E4C2' };
  }

  return (
    <div>
      <div className="card" ref={formRef}>
        <h3>{editingId ? 'แก้ไขรายการประมูล' : 'สร้างรายการประมูลใหม่'}</h3>

        {!editingId && (
          <div style={{ marginBottom: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? 'ซ่อนรายการสินค้า' : 'เลือกจากสินค้าที่มีอยู่'}
            </button>
            <p style={{ fontSize: 12, color: '#8a8378', marginTop: 6 }}>
              เลือกสินค้าที่เคยลงขายไว้ ระบบจะดึงชื่อ/รายละเอียด/รูปภาพ/ค่าจัดส่งมาใส่ให้อัตโนมัติ (ไม่ดึงราคามาให้ ตั้งราคาเริ่มต้นประมูลเองได้เลย) — <b>สินค้าเดิมจะยังโชว์ขายอยู่ในร้านตามปกติ ไม่ได้ถูกซ่อน/ลบให้อัตโนมัติ</b> ถ้าไม่อยากให้ขายซ้ำกัน 2 ทาง ให้ไปกดปุ่ม "ซ่อน" ที่หน้ารายการสินค้าเองอีกที
            </p>
            {showPicker && (
              <div style={{ border: '1.5px solid var(--line)', borderRadius: 9, padding: 10, marginTop: 10 }}>
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="ค้นหาชื่อสินค้า..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13.5, marginBottom: 8 }}
                />
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {filteredPickerProducts.length === 0 ? (
                    <p style={{ color: '#9a9490', fontSize: 13, margin: 4 }}>ไม่พบสินค้า</p>
                  ) : filteredPickerProducts.map((p) => (
                    <div key={p.id} onClick={() => pickProduct(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', cursor: 'pointer', borderRadius: 6 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-dim)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <img src={p.thumbnail_url || p.images?.[0] || ''} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, background: 'var(--paper-dim)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, flex: 1 }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: '#8a8378' }}>฿{p.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="field"><label>ชื่อรายการ</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div className="field"><label>รายละเอียด</label>
          <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
        <div className="field-row">
          <div className="field" style={{ flex: 1 }}><label>ราคาเริ่มต้น (บาท)</label>
            <input type="number" value={draft.startingPrice} onChange={(e) => setDraft({ ...draft, startingPrice: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>ขั้นต่ำต่อการบิด (บาท)</label>
            <input type="number" value={draft.minIncrement} onChange={(e) => setDraft({ ...draft, minIncrement: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>ค่าจัดส่ง (บาท)</label>
            <input type="number" value={draft.shippingFee} onChange={(e) => setDraft({ ...draft, shippingFee: e.target.value })} /></div>
        </div>
        <div className="field">
          <label>อีเว้นท์ (ไม่บังคับ — ใช้สำหรับแยกยอดขายตามอีเว้นท์ในหน้าภาพรวม)</label>
          <select
            value={draft.eventId}
            onChange={(e) => setDraft({ ...draft, eventId: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14 }}
          >
            <option value="">ไม่มีอีเว้นท์</option>
            {eventOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.market === 'dmd' ? '#DMD' : '#GMMTV'})</option>
            ))}
          </select>
        </div>
        <div className="field"><label>วัน-เวลาปิดประมูล</label>
          <input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></div>
        <div className="field">
          <label>รูปภาพ (เพิ่มได้มากกว่า 1 รูป)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          {uploading && <p>กำลังอัปโหลด...</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {draft.images.map((im, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={im} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                <button onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }))}
                  style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" disabled={saving} onClick={saveAuction}>{saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'สร้างรายการประมูล'}</button>
          {editingId && <button className="btn btn-outline" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>ยกเลิก</button>}
        </div>
      </div>

      <div className="card">
        <h3>รายการประมูลทั้งหมด ({auctions.length})</h3>
        {auctions.length === 0 ? (
          <p style={{ color: '#9a9490' }}>ยังไม่มีรายการประมูล</p>
        ) : (
          auctions.map((a) => {
            const s = statusLabel(a);
            const ended = new Date(a.ends_at).getTime() <= Date.now();
            return (
              <div key={a.id} style={{ borderBottom: '1px solid var(--line)', padding: '14px 0' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <img src={a.thumbnail_url || a.images?.[0] || ''} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12.5, color: '#8a8378' }}>
                      {a.current_bid ? `฿${Number(a.current_bid).toLocaleString('th-TH')}` : `เริ่มต้น ฿${Number(a.starting_price).toLocaleString('th-TH')}`}
                      {' · '}{bidCounts[a.id] || 0} บิด{' · '}ปิด {new Date(a.ends_at).toLocaleString('th-TH')}
                      {a.event_id && <>{' · '}{eventOptions.find((c) => c.id === a.event_id)?.name || 'อีเว้นท์'}</>}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.text}</span>
                </div>

                {ended && a.current_bidder_name && (
                  <div style={{ fontSize: 13, color: '#5a5257', marginTop: 8, background: 'var(--paper-dim)', borderRadius: 8, padding: '8px 10px' }}>
                    ผู้ชนะ: {a.current_bidder_name} ({a.current_bidder_contact}) — ฿{Number(a.current_bid).toLocaleString('th-TH')}
                    {a.order_number && <> · เลขออเดอร์ {a.order_number}</>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <button className="btn btn-outline btn-sm" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => toggleHistory(a)}>
                    {expandedId === a.id ? 'ซ่อนประวัติการบิด' : 'ดูประวัติการบิด'}
                  </button>
                  {ended && a.status === 'active' && a.current_bid && (
                    <button className="btn btn-primary btn-sm" style={{ padding: '6px 10px', fontSize: 12, background: 'var(--jade)' }} onClick={() => openCloseModal(a)}>
                      ปิดประมูล (จ่ายเงินนอกเว็บ)
                    </button>
                  )}
                  {a.status === 'active' && (
                    <>
                      <button className="btn btn-outline btn-sm" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => startEdit(a)}>แก้ไข</button>
                      <button className="btn btn-outline btn-sm" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }} onClick={() => cancelAuction(a)}>ยกเลิกรายการ</button>
                    </>
                  )}
                  <button className="btn btn-outline btn-sm" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)', borderColor: 'var(--rose)' }} onClick={() => deleteAuction(a)}>ลบรายการ</button>
                </div>

                {expandedId === a.id && (
                  <div style={{ marginTop: 10, background: 'var(--paper-dim)', borderRadius: 9, padding: '10px 12px', maxHeight: 200, overflowY: 'auto' }}>
                    {bidHistory.length === 0 ? (
                      <p style={{ fontSize: 12.5, color: '#8a8378', margin: 0 }}>ยังไม่มีการบิด</p>
                    ) : (
                      bidHistory.map((b) => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
                          <span>{b.bidder_name} ({b.bidder_contact})</span>
                          <span style={{ fontWeight: 600 }}>฿{Number(b.amount).toLocaleString('th-TH')} · {new Date(b.created_at).toLocaleString('th-TH')}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {closeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(58,50,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: 16, overflowY: 'auto' }}>
          <div className="card" style={{ maxWidth: 460, width: '100%', margin: '20px 0' }}>
            <h3>ปิดประมูล "{closeTarget.name}"</h3>
            <p style={{ color: '#8a8378', fontSize: 13.5 }}>
              ใช้เมื่อผู้ชนะจ่ายเงินทางอื่นนอกเว็บ (เช่น ทักมาโอนตรง) — ระบบจะสร้างออเดอร์จริงให้ทันที สถานะ "รอจัดส่ง" (ข้ามขั้นตอนรอตรวจสลิป เพราะแอดมินยืนยันเองอยู่แล้ว)
              ยอดที่ต้องชำระ: <b>฿{(Number(closeTarget.current_bid) + Number(closeTarget.shipping_fee || 0) + (closeForm.paymentMethod === 'truewallet' ? 20 : 0)).toLocaleString('th-TH')}</b>
            </p>
            <div className="field"><label>บัญชี X ของผู้ชนะ *</label>
              <input value={closeForm.xAccount} onChange={(e) => setCloseForm({ ...closeForm, xAccount: e.target.value })} placeholder="@..." /></div>
            <div className="field"><label>ชื่อ-นามสกุลผู้รับ *</label>
              <input value={closeForm.name} onChange={(e) => setCloseForm({ ...closeForm, name: e.target.value })} /></div>
            <div className="field"><label>ที่อยู่จัดส่ง *</label>
              <textarea rows={3} value={closeForm.address} onChange={(e) => setCloseForm({ ...closeForm, address: e.target.value })} /></div>
            <div className="field"><label>เบอร์โทรศัพท์ *</label>
              <input value={closeForm.phone} onChange={(e) => setCloseForm({ ...closeForm, phone: e.target.value })} /></div>
            <div className="field">
              <label>ช่องทางที่จ่ายจริง</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={closeForm.paymentMethod === 'qr'} onChange={() => setCloseForm({ ...closeForm, paymentMethod: 'qr' })} /><span>QR</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={closeForm.paymentMethod === 'wise'} onChange={() => setCloseForm({ ...closeForm, paymentMethod: 'wise' })} /><span>Wise</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={closeForm.paymentMethod === 'truewallet'} onChange={() => setCloseForm({ ...closeForm, paymentMethod: 'truewallet' })} /><span>TrueWallet (+฿20)</span>
                </label>
              </div>
            </div>
            <div className="field"><label>รหัสติดตามพัสดุ 6 หลัก *</label>
              <input maxLength={6} value={closeForm.trackingCode} onChange={(e) => setCloseForm({ ...closeForm, trackingCode: e.target.value })} placeholder="ตั้งเอง หรือถามผู้ชนะ" /></div>
            <div className="field"><label>หมายเหตุ (ไม่บังคับ)</label>
              <input value={closeForm.note} onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })} placeholder="เช่น จ่ายผ่าน DM 12/8" /></div>
            {closeError && <p style={{ color: 'var(--rose)' }}>{closeError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={closing} onClick={submitAdminClose}>{closing ? 'กำลังบันทึก...' : 'ยืนยันปิดประมูล'}</button>
              <button className="btn btn-outline" onClick={() => setCloseTarget(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
