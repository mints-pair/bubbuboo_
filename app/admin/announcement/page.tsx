'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { compressImageFile } from '@/lib/imageCompress';

const emptyDraft = { title: '', message: '', imageUrl: '' as string | null, sortOrder: '0' };

export default function AdminAnnouncementsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function uploadImage(file: File) {
    setUploading(true);
    const compressed = await compressImageFile(file, { maxDim: 800, quality: 0.8 });
    const path = `settings/announcement-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('shop-images').upload(path, compressed);
    if (!error) {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setDraft((d) => ({ ...d, imageUrl: data.publicUrl }));
    } else {
      alert('อัปโหลดไม่สำเร็จ: ' + error.message);
    }
    setUploading(false);
  }

  async function saveAnnouncement() {
    if (!draft.title.trim() && !draft.message.trim()) { alert('กรุณากรอกหัวข้อหรือข้อความอย่างน้อย 1 อย่าง'); return; }
    setSaving(true);
    const payload = {
      title: draft.title, message: draft.message, image_url: draft.imageUrl,
      sort_order: Number(draft.sortOrder) || 0,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      await supabase.from('announcements').update(payload).eq('id', editingId);
      logAdminAction(`แก้ไขประกาศ "${draft.title || draft.message.slice(0, 20)}"`);
    } else {
      await supabase.from('announcements').insert({ ...payload, enabled: true });
      logAdminAction(`เพิ่มประกาศใหม่ "${draft.title || draft.message.slice(0, 20)}"`);
    }
    setSaving(false);
    setDraft(emptyDraft);
    setEditingId(null);
    load();
  }

  function startEdit(a: any) {
    setEditingId(a.id);
    setDraft({ title: a.title || '', message: a.message || '', imageUrl: a.image_url || null, sortOrder: String(a.sort_order || 0) });
  }

  async function toggleEnabled(a: any) {
    await supabase.from('announcements').update({ enabled: !a.enabled, updated_at: new Date().toISOString() }).eq('id', a.id);
    logAdminAction(`${!a.enabled ? 'เปิด' : 'ปิด'}ใช้งานประกาศ "${a.title || a.message.slice(0, 20)}"`);
    load();
  }

  async function deleteAnnouncement(a: any) {
    if (!confirm(`ลบประกาศ "${a.title || a.message.slice(0, 20)}"?`)) return;
    await supabase.from('announcements').delete().eq('id', a.id);
    logAdminAction(`ลบประกาศ "${a.title || a.message.slice(0, 20)}"`);
    load();
  }

  return (
    <div>
      <div className="card">
        <h3>{editingId ? 'แก้ไขประกาศ' : 'เพิ่มประกาศใหม่'}</h3>
        <p style={{ color: '#8a8378', fontSize: 13.5, marginTop: -6 }}>
          ประกาศทั้งหมดที่ "เปิดใช้งาน" จะโชว์เป็น popup ตอนลูกค้าเปิดเว็บครั้งแรกในแต่ละรอบเข้าชม เลื่อนดูได้ทีละอันถ้ามีหลายรายการ พอกดปิดแล้วจะยุบเหลือไอคอนเล็กๆ ลอยมุมจอไว้ให้เปิดดูซ้ำได้ — เรียงการแสดงผลตาม "ลำดับ" จากน้อยไปมาก
        </p>

        <div className="field"><label>หัวข้อ</label>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="เช่น ปิดรับออเดอร์ชั่วคราว 15-20 ส.ค." /></div>
        <div className="field"><label>ข้อความ</label>
          <textarea rows={4} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} /></div>
        <div className="field" style={{ maxWidth: 140 }}><label>ลำดับการแสดง</label>
          <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></div>

        <div className="field">
          <label>รูปภาพประกอบ (ไม่บังคับ)</label>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          {uploading && <p style={{ fontSize: 12.5, color: '#8a8378' }}>กำลังอัปโหลด...</p>}
          {draft.imageUrl && (
            <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
              <img src={draft.imageUrl} style={{ width: 120, borderRadius: 8, border: '1px solid var(--line)' }} />
              <button onClick={() => setDraft({ ...draft, imageUrl: null })}
                style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12 }}>×</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" disabled={saving} onClick={saveAnnouncement}>{saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มประกาศ'}</button>
          {editingId && <button className="btn btn-outline" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>ยกเลิก</button>}
        </div>
      </div>

      <div className="card">
        <h3>ประกาศทั้งหมด ({items.length})</h3>
        {items.length === 0 ? (
          <p style={{ color: '#9a9490' }}>ยังไม่มีประกาศ</p>
        ) : (
          items.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              {a.image_url && <img src={a.image_url} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{a.title || <span style={{ color: '#9a9490' }}>(ไม่มีหัวข้อ)</span>}</div>
                <div style={{ fontSize: 12.5, color: '#8a8378', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                <div style={{ fontSize: 11.5, color: '#8a8378' }}>ลำดับ {a.sort_order}</div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                background: a.enabled ? 'var(--jade-light)' : '#EDEAE4', color: a.enabled ? 'var(--jade)' : '#8a8378',
              }}>{a.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => toggleEnabled(a)}>{a.enabled ? 'ปิด' : 'เปิด'}</button>
                <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => startEdit(a)}>แก้ไข</button>
                <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--rose)' }} onClick={() => deleteAnnouncement(a)}>ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
