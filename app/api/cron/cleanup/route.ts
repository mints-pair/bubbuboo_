import { NextResponse } from 'next/server';
import { runDataCleanup } from '@/lib/dataCleanup';

export async function GET(req: Request) {
  // Vercel automatically sends this header on its own cron invocations when
  // CRON_SECRET is set as an env var — guards against anyone else hitting
  // this public URL to trigger cleanup (harmless, but no reason to allow it).
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await runDataCleanup();
  return NextResponse.json({ ok: true, ...result });
}
