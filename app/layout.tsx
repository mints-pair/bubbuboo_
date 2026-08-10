import './globals.css';
import type { ReactNode } from 'react';
import { LangProvider } from '@/lib/lang-context';
import IdleLogout from '@/components/IdleLogout';
import { createServerSupabase } from '@/lib/supabase/server';

export async function generateMetadata() {
  const supabase = createServerSupabase();
  const { data } = await supabase.from('settings').select('store_name').single();
  const name = data?.store_name || 'ร้านค้า';
  return {
    title: name,
    description: `${name} - ร้านค้าออนไลน์`,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LangProvider>
          <IdleLogout />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
