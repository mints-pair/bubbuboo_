'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MembersPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('members').select('*').then(({ data }) => setMembers(data || []));
  }, []);

  if (members.length === 0) return <p>ยังไม่มีข้อมูลสมาชิก (จะถูกสร้างอัตโนมัติเมื่อคอนเฟิร์มคำสั่งซื้อ)</p>;

  return (
    <div className="table-scroll">
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
      <thead><tr style={{ textAlign: 'left', color: '#8a8378' }}>
        <th>ชื่อ</th><th>เบอร์โทร</th><th>ที่อยู่</th><th>จำนวนออเดอร์</th><th>ยอดซื้อสะสม</th>
      </tr></thead>
      <tbody>
        {members.map((m) => (
          <tr key={m.phone} style={{ borderBottom: '1px solid var(--line)' }}>
            <td>{m.name}</td>
            <td>{m.phone}</td>
            <td style={{ maxWidth: 260 }}>{m.address}</td>
            <td>{(m.orders || []).length}</td>
            <td>฿{(m.orders || []).reduce((a: number, o: any) => a + Number(o.total), 0).toLocaleString('th-TH')}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
