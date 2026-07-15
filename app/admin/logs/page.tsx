'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, []);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div>
      <p style={{ color: '#8a8378', marginTop: -6, marginBottom: 16 }}>
        แสดงล่าสุด 300 รายการ บันทึกทุกครั้งที่มีการเข้าสู่ระบบ/ออกจากระบบ, จัดการสินค้า, ตั้งค่าร้าน, และดำเนินการกับคำสั่งซื้อ
      </p>
      {loading ? (
        <p>กำลังโหลด...</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#9a9490' }}>ยังไม่มีบันทึกการใช้งาน</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
      )}
    </div>
  );
}
