'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/adminLog';

export default function AdminLoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Already logged in? Skip the form entirely and go straight in.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push('/admin/products');
      } else {
        setChecking(false);
      }
    });
  }, []);

  async function login() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); return; }
    logAdminAction('เข้าสู่ระบบหลังบ้าน');
    router.push('/admin/products');
    router.refresh();
  }

  if (checking) return <div className="container" />;

  return (
    <div className="container" style={{ maxWidth: 380, margin: '60px auto' }}>
      <div className="card">
        <h2>เข้าสู่ระบบหลังบ้าน</h2>
        <div className="field"><label>อีเมล</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
        <div className="field"><label>รหัสผ่าน</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
            onKeyDown={(e) => e.key === 'Enter' && login()} /></div>
        {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading} onClick={login}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </div>
  );
}
