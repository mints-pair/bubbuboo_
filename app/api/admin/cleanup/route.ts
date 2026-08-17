import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { runDataCleanup } from '@/lib/dataCleanup';

export async function POST() {
  const authed = createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await runDataCleanup();

  const supabase = createAdminSupabase();
  await supabase.from('admin_logs').insert({
    admin_email: user.email,
    message: `ล้างข้อมูลเก่าด้วยตนเอง (ลบการจอง ${result.reservationsDeleted} รายการ, log เก่า ${result.logsDeleted} รายการ)`,
  });

  return NextResponse.json({ ok: true, ...result });
}
