'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [shipCount, setShipCount] = useState(0);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname === '/admin/login') return;
    loadCounts();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAdminEmail(user?.email || '');
      setAdminName(user?.user_metadata?.full_name || '');
    });
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function loadCounts() {
    const { count: pc } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: sc } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed');
    setPendingCount(pc || 0);
    setShipCount(sc || 0);
  }

  if (pathname === '/admin/login') return <>{children}</>;

  const TABS = [
    { href: '/admin/products', label: 'อัพโหลดสินค้า' },
    { href: '/admin/orders/pending', label: `คำสั่งซื้อรอการคอนเฟิร์ม${pendingCount ? ` (${pendingCount})` : ''}` },
    { href: '/admin/orders/ship', label: `คำสั่งซื้อรอการส่ง${shipCount ? ` (${shipCount})` : ''}` },
    { href: '/admin/orders/history', label: 'ประวัติการขายทั้งหมด' },
    { href: '/admin/members', label: 'ระบบสมาชิก' },
    { href: '/admin/promotion', label: 'โปรโมชั่น' },
    { href: '/admin/settings', label: 'ตั้งค่าร้าน' },
    { href: '/admin/logs', label: 'บันทึกการใช้งาน' },
  ];

  async function logout() {
    await logAdminAction('ออกจากระบบ');
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/" className="btn btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>← กลับหน้าหลัก</Link>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {adminName || adminEmail || '...'} <span style={{ fontSize: 10 }}>▾</span>
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid var(--line)',
              borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,.1)', minWidth: 160, zIndex: 50, overflow: 'hidden',
            }}>
              <button
                onClick={logout}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none',
                  fontSize: 13.5, color: 'var(--rose)', cursor: 'pointer',
                }}
              >
                ออกจากระบบ
              </button>
            </div>
          )}
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
