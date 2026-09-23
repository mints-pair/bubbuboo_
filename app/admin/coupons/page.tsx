'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';

const emptyDraft = {
  code: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: '',
  minOrderAmount: '', maxUses: '', startsAt: '', endsAt: '',
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminCouponsPage() {
  const supabase = createClient();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
  }
  useEffect(() => { load(); }, []);

  async function saveCoupon() {
    const code = draft.code.trim().toUpperCase();
    if (!code || !draft.discountValue) { alert('กรุณากรอกโค้ดและมูลค่าส่วนลด'); return; }
    setSaving(true);
    const { error } = await supabase.from('coupons').insert({
      code,
      discount_type: draft.discountType,
      discount_value: Number(draft.discountValue) || 0,
      min_order_amount: Number(draft.minOrderAmount) || 0,
      max_uses: draft.maxUses ? Number(draft.maxUses) : null,
      starts_at: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
      ends_at: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
    });
    setSaving(false);
    if (error) { alert('สร้างไม่สำเร็จ: ' + (error.message.includes('duplicate') ? 'มีโค้ดนี้อยู่แล้ว' : error.message)); return; }
    logAdminAction(`สร้างโค้ดส่วนลด "${code}"`);
    setDraft(emptyDraft);
    load();
  }

  async function toggleActive(c: any) {
    await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id);
    logAdminAction(`${!c.active ? 'เปิด' : 'ปิด'}ใช้งานโค้ดส่วนลด "${c.code}"`);
    load();
  }

  async function deleteCoupon(c: any) {
    if (!confirm(`ลบโค้ด "${c.code}"?`)) return;
    await supabase.from('coupons').delete().eq('id', c.id);
    logAdminAction(`ลบโค้ดส่วนลด "${c.code}"`);
    load();
  }

  function statusOf(c: any) {
    const now = Date.now();
    if (!c.active) return { text: 'ปิดใช้งาน', color: '#8a8378', bg: '#EDEAE4' };
    if (c.starts_at && now < new Date(c.starts_at).getTime()) return { text: 'ยังไม่เริ่ม', color: '#8A6A2F', bg: '#F3E4C2' };
    if (c.ends_at && now > new Date(c.ends_at).getTime()) return { text: 'หมดอายุ', color: 'var(--rose)', bg: '#F3E0DC' };
    if (c.max_uses != null && c.used_count >= c.max_uses) return { text: 'ใช้ครบแล้ว', color: 'var(--rose)', bg: '#F3E0DC' };
    return { text: 'ใช้งานได้', color: 'var(--jade)', bg: 'var(--jade-light)' };
  }

  return (
    <div>
      <div className="card">
        <h3>สร้างโค้ดส่วนลดใหม่</h3>
        <div className="field"><label>โค้ด (ลูกค้าจะพิมพ์เป็นตัวพิมพ์ใหญ่หรือเล็กก็ได้)</label>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="เช่น WELCOME10" /></div>

        <div className="field">
          <label>ประเภทส่วนลด</label>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={draft.discountType === 'percent'} onChange={() => setDraft({ ...draft, discountType: 'percent' })} /><span>เปอร์เซ็นต์ (%)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="radio" checked={draft.discountType === 'fixed'} onChange={() => setDraft({ ...draft, discountType: 'fixed' })} /><span>ลดตายตัว (บาท)</span>
            </label>
          </div>
        </div>

        <div className="field-row">
          <div className="field" style={{ flex: 1 }}><label>มูลค่าส่วนลด {draft.discountType === 'percent' ? '(%)' : '(บาท)'}</label>
            <input type="number" value={draft.discountValue} onChange={(e) => setDraft({ ...draft, discountValue: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>ยอดขั้นต่ำที่ใช้ได้ (บาท)</label>
            <input type="number" value={draft.minOrderAmount} onChange={(e) => setDraft({ ...draft, minOrderAmount: e.target.value })} placeholder="0 = ไม่มีขั้นต่ำ" /></div>
          <div className="field" style={{ flex: 1 }}><label>จำนวนครั้งที่ใช้ได้ทั้งหมด</label>
            <input type="number" value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} placeholder="เว้นว่าง = ไม่จำกัด" /></div>
        </div>

        <div className="field-row">
          <div className="field" style={{ flex: 1 }}><label>วันเริ่มใช้งาน (ไม่บังคับ)</label>
            <input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></div>
          <div className="field" style={{ flex: 1 }}><label>วันหมดอายุ (ไม่บังคับ)</label>
            <input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></div>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={saveCoupon}>{saving ? 'กำลังบันทึก...' : 'สร้างโค้ด'}</button>
      </div>

      <div className="card">
        <h3>โค้ดส่วนลดทั้งหมด ({coupons.length})</h3>
        {coupons.length === 0 ? (
          <p style={{ color: '#9a9490' }}>ยังไม่มีโค้ดส่วนลด</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#8a8378' }}>
                <th>โค้ด</th><th>ส่วนลด</th><th>ยอดขั้นต่ำ</th><th>ใช้ไปแล้ว</th><th>สถานะ</th><th></th>
              </tr></thead>
              <tbody>
                {coupons.map((c) => {
                  const s = statusOf(c);
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ fontWeight: 700 }}>{c.code}</td>
                      <td>{c.discount_type === 'percent' ? `${c.discount_value}%` : `฿${c.discount_value}`}</td>
                      <td>{c.min_order_amount > 0 ? `฿${c.min_order_amount}` : '-'}</td>
                      <td>{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</td>
                      <td><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color }}>{s.text}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, marginRight: 6 }} onClick={() => toggleActive(c)}>
                          {c.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                        <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }} onClick={() => deleteCoupon(c)}>ลบ</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
