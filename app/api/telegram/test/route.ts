import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { sendAdminTelegramMessage } from '@/lib/telegram';

// Visit /api/telegram/test while logged in as admin to confirm your
// TELEGRAM_BOT_TOKEN and ADMIN_TELEGRAM_CHAT_ID are set up correctly.
export async function GET() {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await sendAdminTelegramMessage('ทดสอบระบบแจ้งเตือน: การตั้งค่า Telegram ใช้งานได้แล้ว');
  return NextResponse.json({ ok: true });
}
