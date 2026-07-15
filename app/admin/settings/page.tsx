'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<any>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function load() {
    const { data: s } = await supabase.from('settings').select('*').single();
    setSettings(s);
  }
  useEffect(() => { load(); }, []);

  async function uploadQr(file: File) {
    setUploadingQr(true);
    const ext = file.name.split('.').pop();
    const path = `settings/qr-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('shop-images').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setSettings((s: any) => ({ ...s, qr_image_url: data.publicUrl }));
    } else {
      alert('อัปโหลดไม่สำเร็จ: ' + error.message);
    }
    setUploadingQr(false);
  }

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    const ext = file.name.split('.').pop();
    const path = `settings/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('shop-images').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path);
      setSettings((s: any) => ({ ...s, logo_url: data.publicUrl }));
    } else {
      alert('อัปโหลดไม่สำเร็จ: ' + error.message);
    }
    setUploadingLogo(false);
  }

  async function saveSettings() {
    await supabase.from('settings').update({
      store_name: settings.store_name,
      qr_image_url: settings.qr_image_url,
      logo_url: settings.logo_url,
    }).eq('id', 1);
    logAdminAction('บันทึกการตั้งค่าร้าน');
    alert('บันทึกการตั้งค่าแล้ว');
  }

  if (!settings) return null;

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3>ตั้งค่าร้าน</h3>
      <div className="field"><label>ชื่อร้าน</label>
        <input value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} /></div>
      <div className="field">
        <label>โลโก้ร้าน</label>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        {uploadingLogo && <p>กำลังอัปโหลด...</p>}
        {settings.logo_url && (
          <img src={settings.logo_url} style={{ width: 80, height: 80, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 8, marginTop: 10 }} />
        )}
      </div>
      <div className="field">
        <label>รูป QR รับเงิน (พร้อมเพย์)</label>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])} />
        {uploadingQr && <p>กำลังอัปโหลด...</p>}
        {settings.qr_image_url && (
          <img src={settings.qr_image_url} style={{ width: 140, height: 140, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 8, marginTop: 10 }} />
        )}
      </div>
      <button className="btn btn-outline" onClick={saveSettings}>บันทึกการตั้งค่า</button>
    </div>
  );
}
