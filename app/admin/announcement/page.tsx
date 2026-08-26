'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import { compressImageFile } from '@/lib/imageCompress';

export default function AdminAnnouncementPage() {
  const supabase = createClient();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data } = await supabase.from('announcement').select('*').single();
    setAnnouncement(data);
  }
  useEffect(() => { load(); }, []);

  async function uploadImage(file: File) {
    setUploading(true);
    const compressed = await compressImageFile(file, { maxDim: 800, quality: 0.8 });
    const path = `settings/announcement-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('shop-images').upload(path, compressed);
    if (!error) {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setAnnouncement((a: any) => ({ ...a, image_url: data.publicUrl }));
    } else {
      alert('อัปโหลดไม่สำเร็จ: ' + error.message);
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    await supabase.from('announcement').update({
      enabled: announcement.enabled,
      title: announcement.title,
      message: announcement.message,
      image_url: announcement.image_url,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    logAdminAction(`บันทึกประกาศหน้าร้าน (${announcement.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'})`);
    alert('บันทึกแล้ว — ลูกค้าที่เคยปิดประกาศไปแล้วจะเห็นเวอร์ชันใหม่นี้อีกครั้ง เพราะข้อความเปลี่ยนไป');
    load();
  }

  if (!announcement) return null;

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h3>ประกาศหน้าร้าน</h3>
      <p style={{ color: '#8a8378', fontSize: 13.5, marginTop: -6 }}>
        แสดงเป็น popup ตอนลูกค้าเปิดเว็บครั้งแรกในแต่ละรอบเข้าชม พอกดปิดแล้วจะยุบเหลือไอคอนเล็กๆ ลอยมุมจอไว้ให้กดเปิดดูซ้ำได้ตลอด
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', cursor: 'pointer' }}>
        <input type="checkbox" checked={announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} style={{ width: 18, height: 18 }} />
        <span style={{ fontWeight: 600 }}>เปิดใช้งานประกาศ</span>
      </label>

      <div className="field"><label>หัวข้อ</label>
        <input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="เช่น ปิดรับออเดอร์ชั่วคราว 15-20 ส.ค." /></div>
      <div className="field"><label>ข้อความ</label>
        <textarea rows={4} value={announcement.message} onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })} /></div>

      <div className="field">
        <label>รูปภาพประกอบ (ไม่บังคับ)</label>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        {uploading && <p style={{ fontSize: 12.5, color: '#8a8378' }}>กำลังอัปโหลด...</p>}
        {announcement.image_url && (
          <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
            <img src={announcement.image_url} style={{ width: 120, borderRadius: 8, border: '1px solid var(--line)' }} />
            <button onClick={() => setAnnouncement({ ...announcement, image_url: null })}
              style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rose)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 12 }}>×</button>
          </div>
        )}
      </div>

      <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึกประกาศ'}</button>
    </div>
  );
}
