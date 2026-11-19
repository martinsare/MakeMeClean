import {
  VercelRequest,
  VercelResponse,
  getAdminSupabase,
  sendSuccess,
  sendError,
  getEnv,
  escapeTelegramMarkdown,
  getClientIp,
  checkServerRateLimit,
} from '../_lib/server.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function handleContact(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const ip = getClientIp(req);
    const allowed = await checkServerRateLimit(`contact:${ip}`, 5, 600);
    if (!allowed) {
      return sendError(res, 'Too many contact submissions. Please wait a few minutes and try again.', 429);
    }

    const body = req.body || {};
    const readString = (value: unknown) =>
      typeof value === 'string' ? value.trim() : '';
    const name = readString(body.name);
    const email = readString(body.email).toLowerCase();
    const phone = readString(body.phone);
    const subject = readString(body.subject) || 'Website Inquiry';
    const message = readString(body.message);

    if (!name || !email || !message) {
      return sendError(res, 'Please provide name, email, and message.', 400);
    }
    if (!EMAIL_RE.test(email)) {
      return sendError(res, 'Please provide a valid email address.', 400);
    }
    if (
      name.length > 160 ||
      email.length > 254 ||
      phone.length > 40 ||
      subject.length > 160 ||
      message.length > 5000
    ) {
      return sendError(res, 'One or more contact fields exceed the allowed length.', 400);
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        status: 'new',
      });

    if (error) {
      console.error('[contact] insert error:', error);
      return sendError(res, 'Failed to submit contact message', 500);
    }

    // Telegram notification (awaited with bounded timeout so serverless doesn't drop it)
    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = getEnv('TELEGRAM_ADMIN_CHAT_ID') || getEnv('TELEGRAM_CHAT_ID');
    if (botToken && chatId) {
      try {
        const preview = message.length > 600 ? `${message.slice(0, 600)}…` : message;
        const text =
          `📩 *New Contact Message*\n\n` +
          `• *From:* ${escapeTelegramMarkdown(name)} (${escapeTelegramMarkdown(email)})\n` +
          `• *Phone:* ${escapeTelegramMarkdown(phone || 'N/A')}\n` +
          `• *Subject:* ${escapeTelegramMarkdown(subject)}\n\n` +
          `"${escapeTelegramMarkdown(preview)}"`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
          }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
      } catch (tgErr) {
        console.warn('[contact] Telegram alert failed:', tgErr);
      }
    }

    return sendSuccess(res, {
      message: 'Thank you for reaching out. We have received your inquiry.',
    }, 201);
  } catch (err: any) {
    console.error('[contact] unexpected error:', err);
    return sendError(res, 'Failed to submit contact message', 500);
  }
}

