'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Renders nothing — just watches for user activity anywhere on the site.
// If an admin is logged in and the site sees no activity (mouse, keyboard,
// touch, scroll) for 10 minutes straight, it signs them out automatically.
// Navigating around the site (including back to the storefront) does NOT
// log them out — only true inactivity does.
export default function IdleLogout() {
  const supabase = createClient();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSessionRef = useRef(false);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    function resetTimer() {
      clearTimer();
      if (!hasSessionRef.current) return;
      timerRef.current = setTimeout(async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
      }, TIMEOUT_MS);
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      hasSessionRef.current = !!session;
      resetTimer();
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hasSessionRef.current = !!session;
      if (session) resetTimer();
      else clearTimer();
    });

    function onActivity() {
      if (hasSessionRef.current) resetTimer();
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearTimer();
      sub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
