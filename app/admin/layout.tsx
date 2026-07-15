'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ReactNode } from 'react';

const TABS = [
  { href: '/admin/products', label: 'อัพโหลดสินค้า' },
  { href: '/admin/orders/pending', label: 'คำสั่งซื้อรอการคอนเฟิร์ม' },
  { href: '/admin/orders/ship', label: 'คำสั่งซื้อรอการส่ง' },
  { href: '/admin/orders/history', label: 'ประวัติการขายทั้งหมด' },
  { href: '/admin/members', label: 'ระบบสมาชิก' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  if (pathname === '/admin/login') return <>{children}</>;

  async function logout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h1>ระบบหลังบ้าน</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/" className="btn btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>← กลับหน้าหลัก</Link>
          <button className="btn btn-outline" onClick={logout}>ออกจากระบบ</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '20px 0' }}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} style={{
            padding: '9px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
            border: '1.5px solid var(--line)',
            background: pathname === t.href ? 'var(--plum)' : '#fff',
            color: pathname === t.href ? '#fff' : 'var(--ink)',
          }}>{t.label}</Link>
        ))}
      </div>
      {children}
    </div>
  );
}
