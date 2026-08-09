export function htmlEscape(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c] ?? c))
}

export async function sendEmail(args: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  const replyTo = Deno.env.get('EMAIL_REPLY_TO')

  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.')
  if (!from) throw new Error('EMAIL_FROM is not configured.')

  const payload: Record<string, unknown> = {
    from,
    to: [args.to],
    subject: args.subject,
    html: args.html,
  }
  if (replyTo) payload.reply_to = replyTo

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result?.message || `Email provider returned ${response.status}.`)
  }
  return result
}

export function emailShell(content: string) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f3ef;margin:0;padding:24px;color:#312a27">
  <div style="max-width:620px;margin:auto;background:white;border-radius:18px;padding:30px;border:1px solid #eadfd7">
  <div style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#8b6d61">Jordan &amp; Rochelle</div>
  ${content}
  <p style="margin-top:28px;color:#756963;font-size:13px">November 14, 2026 · Milbank, South Dakota</p>
  </div></body></html>`
}
