'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const DISMISS_KEY = 'shop_announcement_dismissed_at';

export default function AnnouncementPopup() {
  const supabase = createClient();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    supabase.from('announcement').select('*').single().then(({ data }) => {
      if (!data || !data.enabled) return;
      setAnnouncement(data);
      const dismissedAt = sessionStorage.getItem(DISMISS_KEY);
      if (dismissedAt === data.updated_at) {
        setShowBadge(true); // already saw this exact announcement this session
      } else {
        setOpen(true);
      }
    });
  }, []);

  function close() {
    setOpen(false);
    setShowBadge(true);
    if (announcement) sessionStorage.setItem(DISMISS_KEY, announcement.updated_at);
  }

  if (!announcement) return null;

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
            {announcement.image_url && (
              <img src={announcement.image_url} style={{ width: '100%', borderRadius: 10, marginBottom: 14 }} />
            )}
            {announcement.title && <h3 style={{ marginTop: 0 }}>{announcement.title}</h3>}
            {announcement.message && <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#5a5257' }}>{announcement.message}</p>}
            <button className="btn btn-primary" onClick={close}>ปิด</button>
          </div>
        </div>
      )}

      {showBadge && !open && (
        <button
          onClick={() => setOpen(true)}
          title={announcement.title || 'ประกาศ'}
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
