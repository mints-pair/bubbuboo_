'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { isPromotionLive } from '@/lib/promotion';

const DEFAULT_PROMO = {
  active: false,
  discount_active: false,
  discount_percent: 0,
  discount_scope: 'all' as 'all' | 'selected',
  discount_product_ids: [] as string[],
  free_shipping_active: false,
  free_shipping_min_amount: 0,
  label: '',
  start_at: null as string | null,
  end_at: null as string | null,
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPromotionPage() {
  const supabase = createClient();
  const [promo, setPromo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function load() {
    const { data } = await supabase.from('promotion').select('*').single();
    setPromo(data);
    const { data: p } = await supabase.from('products').select('id, name, price, images').order('name', { ascending: true });
    setProducts(p || []);
  }
  useEffect(() => { load(); }, []);

  async function save(patch?: any) {
    const payload = patch || promo;
    setSaving(true);
    await supabase.from('promotion').update({
      active: payload.active,
      discount_active: payload.discount_active,
      discount_percent: Number(payload.discount_percent) || 0,
      discount_scope: payload.discount_scope,
      discount_product_ids: payload.discount_product_ids,
      free_shipping_active: payload.free_shipping_active,
      free_shipping_min_amount: Number(payload.free_shipping_min_amount) || 0,
      label: payload.label,
      start_at: payload.start_at || null,
      end_at: payload.end_at || null,
    }).eq('id', 1);
    setSaving(false);
    logAdminAction(`บันทึกโปรโมชั่น (${payload.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'})`);
    alert('บันทึกโปรโมชั่นแล้ว');
    load();
  }

  async function resetPromotion() {
    if (!confirm('ล้างโปรโมชั่นกลับเป็นค่าเริ่มต้นทั้งหมด (ปิดทุกอย่าง ล้างวันที่และสินค้าที่เลือกไว้)? การกระทำนี้ย้อนกลับไม่ได้')) return;
    setResetting(true);
    await supabase.from('promotion').update(DEFAULT_PROMO).eq('id', 1);
    setResetting(false);
    logAdminAction('รีเซ็ตโปรโมชั่นกลับเป็นค่าเริ่มต้น');
    alert('รีเซ็ตโปรโมชั่นแล้ว');
    load();
  }

  function toggleProduct(id: string) {
    const current: string[] = promo.discount_product_ids || [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setPromo({ ...promo, discount_product_ids: next });
  }

  if (!promo) return null;

  const live = isPromotionLive(promo);

  return (
    <div className="card" style={{ maxWidth: 560 }}>
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
          <span style={{ fontWeight: 600 }}>ลดราคาสินค้า</span>
        </label>
        {promo.discount_active && (
          <div style={{ marginLeft: 28 }}>
            <div className="field" style={{ maxWidth: 160 }}>
              <label>เปอร์เซ็นต์ส่วนลด (%)</label>
              <input type="number" min={0} max={100} value={promo.discount_percent} onChange={(e) => setPromo({ ...promo, discount_percent: e.target.value })} />
            </div>

            <div className="field">
              <label>ใช้กับสินค้า</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={promo.discount_scope === 'all'} onChange={() => setPromo({ ...promo, discount_scope: 'all' })} />
                  <span>ทุกชิ้นในร้าน</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" checked={promo.discount_scope === 'selected'} onChange={() => setPromo({ ...promo, discount_scope: 'selected' })} />
                  <span>เลือกเฉพาะบางชิ้น</span>
                </label>
              </div>
            </div>

            {promo.discount_scope === 'selected' && (
              <div>
                <p style={{ fontSize: 12.5, color: '#8a8378', marginBottom: 8 }}>
                  เลือกแล้ว {(promo.discount_product_ids || []).length} ชิ้น
                </p>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 9, padding: 8 }}>
                  {products.length === 0 ? (
                    <p style={{ color: '#9a9490', fontSize: 13, margin: 4 }}>ยังไม่มีสินค้าในร้าน</p>
                  ) : products.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(promo.discount_product_ids || []).includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                      />
                      <img src={p.images?.[0] || ''} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, background: 'var(--paper-dim)' }} />
                      <span style={{ fontSize: 13.5 }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: '#8a8378', marginLeft: 'auto' }}>฿{p.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 16, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={promo.free_shipping_active} onChange={(e) => setPromo({ ...promo, free_shipping_active: e.target.checked })} style={{ width: 18, height: 18 }} />
          <span style={{ fontWeight: 600 }}>ส่งฟรี</span>
        </label>
        <p style={{ fontSize: 12.5, color: '#8a8378', marginTop: 6, marginBottom: 10, marginLeft: 28 }}>ส่งฟรีเป็นแบบทั้งออเดอร์เท่านั้น เลือกเฉพาะบางชิ้นไม่ได้ (เพราะค่าส่งคิดต่อคำสั่งซื้อ)</p>
        {promo.free_shipping_active && (
          <div className="field" style={{ marginLeft: 28, maxWidth: 220 }}>
            <label>ยอดขั้นต่ำ (บาท)</label>
            <input type="number" min={0} value={promo.free_shipping_min_amount} onChange={(e) => setPromo({ ...promo, free_shipping_min_amount: e.target.value })} placeholder="0" />
            <p style={{ fontSize: 12, color: '#8a8378', marginTop: 6 }}>
              เว้นว่างหรือใส่ 0 = ส่งฟรีทุกออเดอร์ไม่มีเงื่อนไข<br />
              ใส่ตัวเลข = ส่งฟรีเฉพาะออเดอร์ที่ยอดสินค้าถึงจำนวนนี้ขึ้นไป
            </p>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 16, marginBottom: 20 }}>
        <div className="field"><label>ข้อความแบนเนอร์ (โชว์บนหน้าร้าน ไม่ใส่ก็ได้)</label>
          <input value={promo.label} onChange={(e) => setPromo({ ...promo, label: e.target.value })} placeholder="เช่น ลดราคาทุกชิ้น 10% ถึงสิ้นเดือนนี้!" /></div>
        <div className="field-row">
          <div className="field" style={{ flex: 1 }}><label>วันเริ่ม (ไม่บังคับ)</label>
            <input type="datetime-local" value={toLocalInputValue(promo.start_at)} onChange={(e) => setPromo({ ...promo, start_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          <div className="field" style={{ flex: 1 }}><label>วันสิ้นสุด (ไม่บังคับ)</label>
            <input type="datetime-local" value={toLocalInputValue(promo.end_at)} onChange={(e) => setPromo({ ...promo, end_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" disabled={saving} onClick={() => save()}>{saving ? 'กำลังบันทึก...' : 'บันทึกโปรโมชั่น'}</button>
        <button className="btn btn-outline" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }} disabled={resetting} onClick={resetPromotion}>
          {resetting ? 'กำลังรีเซ็ต...' : 'รีเซ็ตกลับค่าเริ่มต้น'}
        </button>
      </div>
    </div>
  );
}
