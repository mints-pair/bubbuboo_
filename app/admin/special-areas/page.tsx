'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';

export default function SpecialAreasPage() {
  const supabase = createClient();
  const [areas, setAreas] = useState<any[]>([]);
  const [postalCode, setPostalCode] = useState('');
  const [areaName, setAreaName] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('special_shipping_areas').select('*').order('postal_code', { ascending: true });
    setAreas(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addArea() {
    if (!postalCode.trim() || !areaName.trim()) { alert('กรุณากรอกรหัสไปรษณีย์และชื่อพื้นที่'); return; }
    const { error } = await supabase.from('special_shipping_areas').insert({ postal_code: postalCode.trim(), area_name: areaName.trim() });
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return; }
    logAdminAction(`เพิ่มพื้นที่ขนส่งพิเศษ "${postalCode.trim()} - ${areaName.trim()}"`);
    setPostalCode('');
    setAreaName('');
    load();
  }

  async function deleteArea(id: string, label: string) {
    if (!confirm(`ลบ "${label}"?`)) return;
    await supabase.from('special_shipping_areas').delete().eq('id', id);
    logAdminAction(`ลบพื้นที่ขนส่งพิเศษ "${label}"`);
    load();
  }

  return (
    <div>
      <div className="card">
        <h3>เพิ่มพื้นที่ขนส่งพิเศษ</h3>
        <p style={{ color: '#8a8378', fontSize: 13.5, marginTop: -6 }}>
          รายการนี้จะโชว์ให้ลูกค้าดูตอนเลือก "พื้นที่ขนส่งพิเศษ" ในหน้าตะกร้า เพื่อให้เช็คได้ว่าที่อยู่ตัวเองเข้าเกณฑ์หรือไม่
        </p>
        <div className="field-row">
          <div className="field" style={{ flex: 1 }}><label>รหัสไปรษณีย์</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="เช่น 96000" /></div>
          <div className="field" style={{ flex: 2 }}><label>ชื่อพื้นที่</label>
            <input value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="เช่น อำเภอเกาะสมุย จ.สุราษฎร์ธานี" /></div>
        </div>
        <button className="btn btn-primary" onClick={addArea}>เพิ่มพื้นที่</button>
      </div>

      <div className="card">
        <h3>รายการพื้นที่ขนส่งพิเศษ ({areas.length})</h3>
        {loading ? null : areas.length === 0 ? (
          <p style={{ color: '#9a9490' }}>ยังไม่มีรายการ</p>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: '#8a8378' }}>
                <th>รหัสไปรษณีย์</th><th>ชื่อพื้นที่</th><th></th>
              </tr></thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td>{a.postal_code}</td>
                    <td>{a.area_name}</td>
                    <td>
                      <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }}
                        onClick={() => deleteArea(a.id, `${a.postal_code} - ${a.area_name}`)}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
