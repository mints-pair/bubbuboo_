// Sends a message to the admin via a Telegram bot. Much simpler to set up
// than LINE's Messaging API — no business verification, no Official Account,
// just a personal bot created through @BotFather. See DEPLOY.md step 6.
export async function sendAdminTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram not configured, skipping notification:', text);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error('Telegram push failed', res.status, await res.text());
    }
  } catch (err) {
    console.error('Telegram push error', err);
  }
}
