function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMessageText(row) {
  return [
    '📋 <b>New service submission</b>',
    '',
    `<b>${escapeHtml(row.title)}</b>`,
    `📂 ${escapeHtml(row.category)}`,
    `📞 ${escapeHtml(row.phone)}`,
    `✉️ ${escapeHtml(row.email)}`,
    row.address ? `📍 ${escapeHtml(row.address)}` : null,
    row.website ? `🌐 ${escapeHtml(row.website)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });
}

export async function sendTelegramNotification(record, serviceId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = buildMessageText(record);
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };

  if (serviceId) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `approve_${serviceId}` },
        { text: '❌ Delete', callback_data: `delete_${serviceId}` },
      ]],
    };
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
