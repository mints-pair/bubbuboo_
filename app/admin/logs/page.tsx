'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  function loadLogs() {
    setLoading(true);
    supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }

  async function runCleanup() {
    if (!confirm('ล้างข้อมูลเก่าตอนนี้เลย? (ลบการจองตะกร้าที่หมดอายุเกิน 1 วัน และ log การใช้งานที่เก่าเกิน 6 เดือน)')) return;
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await fetch('/api/admin/cleanup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      setCleanupResult(`เสร็จแล้ว — ลบการจองที่หมดอายุ ${data.reservationsDeleted} รายการ, ลบ log เก่า ${data.logsDeleted} รายการ`);
      loadLogs();
    } catch (e: any) {
      setCleanupResult(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setCleaning(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div>
      <div className="card">
        <h3>ทำความสะอาดข้อมูลเก่า</h3>
        <p style={{ color: '#8a8378', fontSize: 13.5, marginTop: -6 }}>
          ระบบล้างข้อมูลที่ไม่มีประโยชน์แล้วให้อัตโนมัติทุกวัน (การจองตะกร้า 10 นาทีที่หมดอายุไปเกิน 1 วัน, log การใช้งานที่เก่าเกิน 6 เดือน) — <b>ไม่แตะออเดอร์ สินค้า สมาชิก หรือประมูลเด็ดขาด</b> ปุ่มนี้ไว้กดล้างเองได้ทันทีถ้าไม่อยากรอรอบอัตโนมัติ
        </p>
        <button className="btn btn-outline" disabled={cleaning} onClick={runCleanup}>
          {cleaning ? 'กำลังล้างข้อมูล...' : 'ล้างข้อมูลเก่าตอนนี้'}
        </button>
        {cleanupResult && <p style={{ color: 'var(--jade)', marginTop: 10, fontSize: 13.5 }}>{cleanupResult}</p>}
      </div>

      <p style={{ color: '#8a8378', marginTop: -6, marginBottom: 16 }}>
        แสดงล่าสุด 300 รายการ บันทึกทุกครั้งที่มีการเข้าสู่ระบบ/ออกจากระบบ, จัดการสินค้า, ตั้งค่าร้าน, และดำเนินการกับคำสั่งซื้อ
      </p>
      {loading ? (
        <p>กำลังโหลด...</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#9a9490' }}>ยังไม่มีบันทึกการใช้งาน</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#8a8378', background: 'var(--paper-dim)' }}>
                <th style={{ padding: '10px 14px' }}>เวลา</th>
                <th style={{ padding: '10px 14px' }}>แอดมิน</th>
                <th style={{ padding: '10px 14px' }}>การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#8a8378' }}>{formatTime(l.created_at)}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{l.admin_email}</td>
                  <td style={{ padding: '10px 14px' }}>{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
