'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const DISMISS_KEY = 'shop_announcements_dismissed_v1';

export default function AnnouncementPopup() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    supabase.from('announcements').select('*').eq('enabled', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = data || [];
        if (list.length === 0) return;
        setItems(list);
        const key = JSON.stringify(list.map((a: any) => ({ id: a.id, updated_at: a.updated_at })));
        const dismissedKey = sessionStorage.getItem(DISMISS_KEY);
        if (dismissedKey === key) {
          setShowBadge(true); // already saw this exact set this session
        } else {
          setIndex(0);
          setOpen(true);
        }
      });
  }, []);

  function close() {
    setOpen(false);
    setShowBadge(true);
    if (items.length) {
      const key = JSON.stringify(items.map((a) => ({ id: a.id, updated_at: a.updated_at })));
      sessionStorage.setItem(DISMISS_KEY, key);
    }
  }

  function reopen() {
    setIndex(0);
    setOpen(true);
  }

  if (items.length === 0) return null;
  const current = items[index];

  return (
    <>
      {open && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(58,50,42,.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 420, width: '100%', margin: 0, position: 'relative' }}>
            <button
              onClick={close}
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8a8378', lineHeight: 1 }}
            >
              ×
            </button>

            {current.image_url && (
              <img src={current.image_url} style={{ width: '100%', borderRadius: 10, marginBottom: 14 }} />
            )}
            {current.title && <h3 style={{ marginTop: 0 }}>{current.title}</h3>}
            {current.message && <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#5a5257' }}>{current.message}</p>}

            {items.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '4px 0 14px' }}>
                {items.map((_, i) => (
                  <span key={i} onClick={() => setIndex(i)} style={{
                    width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                    background: i === index ? 'var(--plum)' : 'var(--line)',
                  }} />
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {items.length > 1 && index > 0 && (
                <button className="btn btn-outline" onClick={() => setIndex((i) => i - 1)}>← ก่อนหน้า</button>
              )}
              {items.length > 1 && index < items.length - 1 ? (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setIndex((i) => i + 1)}>ถัดไป →</button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={close}>ปิด</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showBadge && !open && (
        <button
          onClick={reopen}
          title="ประกาศ"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 90,
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'var(--plum)', color: '#fff', fontSize: 22, cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          📣
        </button>
      )}
    </>
  );
}
