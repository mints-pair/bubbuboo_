'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { isPromotionLive } from '@/lib/promotion';

function toLocalInputValue(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPromotionPage() {
  const supabase = createClient();
  const [promo, setPromo] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('promotion').select('*').single();
    setPromo(data);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    await supabase.from('promotion').update({
      active: promo.active,
      discount_active: promo.discount_active,
      discount_percent: Number(promo.discount_percent) || 0,
      free_shipping_active: promo.free_shipping_active,
      label: promo.label,
      start_at: promo.start_at || null,
      end_at: promo.end_at || null,
    }).eq('id', 1);
    setSaving(false);
    logAdminAction(`บันทึกโปรโมชั่น (${promo.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'})`);
    alert('บันทึกโปรโมชั่นแล้ว');
    load();
  }

  if (!promo) return null;

  const live = isPromotionLive(promo);

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>โปรโมชั่น</h3>
        <span style={{
          fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
          background: live ? 'var(--jade-light)' : '#EDEAE4', color: live ? 'var(--jade)' : '#8a8378',
        }}>
          {live ? 'กำลังใช้งานอยู่ตอนนี้' : 'ไม่ได้ใช้งานอยู่'}
        </span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', cursor: 'pointer' }}>
        <input type="checkbox" checked={promo.active} onChange={(e) => setPromo({ ...promo, active: e.target.checked })} style={{ width: 18, height: 18 }} />
        <span style={{ fontWeight: 600 }}>เปิดใช้งานโปรโมชั่น (สวิตช์หลัก)</span>
      </label>
      <p style={{ fontSize: 12.5, color: '#8a8378', marginTop: -10, marginBottom: 18 }}>
        ถ้าตั้งวันเริ่ม/สิ้นสุดไว้ด้านล่าง ระบบจะเปิด-ปิดให้อัตโนมัติตามเวลา (สวิตช์นี้ต้องเปิดไว้ด้วย) ถ้าไม่ตั้งวันที่ ให้ควบคุมด้วยสวิตช์นี้อย่างเดียว

      </p>

      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 16, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={promo.discount_active} onChange={(e) => setPromo({ ...promo, discount_active: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span style={{ fontWeight: 600 }}>ลดราคาทุกชิ้น</span>
        </label>
        {promo.discount_active && (
          <div className="field" style={{ maxWidth: 160, marginLeft: 28 }}>
            <label>เปอร์เซ็นต์ส่วนลด (%)</label>
            <input type="number" min={0} max={100} value={promo.discount_percent} onChange={(e) => setPromo({ ...promo, discount_percent: e.target.value })} />
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 16, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={promo.free_shipping_active} onChange={(e) => setPromo({ ...promo, free_shipping_active: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span style={{ fontWeight: 600 }}>ส่งฟรีทุกออเดอร์</span>
        </label>
      </div>

      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 16 }}>
        <div className="field"><label>ข้อความแบนเนอร์ (โชว์บนหน้าร้าน ไม่ใส่ก็ได้)</label>
          <input value={promo.label} onChange={(e) => setPromo({ ...promo, label: e.target.value })} placeholder="เช่น ลดราคาทุกชิ้น 10% ถึงสิ้นเดือนนี้!" /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>วันเริ่ม (ไม่บังคับ)</label>
            <input type="datetime-local" value={toLocalInputValue(promo.start_at)} onChange={(e) => setPromo({ ...promo, start_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          <div className="field" style={{ flex: 1 }}><label>วันสิ้นสุด (ไม่บังคับ)</label>
            <input type="datetime-local" value={toLocalInputValue(promo.end_at)} onChange={(e) => setPromo({ ...promo, end_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
        </div>
      </div>

      <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึกโปรโมชั่น'}</button>
    </div>
  );
}
