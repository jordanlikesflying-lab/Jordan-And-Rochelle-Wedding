import { withSupabase } from "npm:@supabase/server@^1";

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] ?? c));
}

function temporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `W!${Array.from(bytes).map(b => (b % 36).toString(36)).join('')}9a`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  const replyTo = Deno.env.get('EMAIL_REPLY_TO');
  if (!apiKey || !from) throw new Error('Email secrets are not configured.');
  const payload: Record<string, unknown> = { from, to:[to], subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || 'Could not send administrator email.');
}

async function findAuthUser(client: any, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage:100 });
    if (error) throw error;
    const found = data.users.find((u: any) => String(u.email || '').toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
}

async function resetLink(client: any, email: string, siteUrl: string) {
  const { data, error } = await client.auth.admin.generateLink({ type:'recovery', email, redirectTo:`${siteUrl}/command-center.html?set-admin-password=1` });
  if (error) throw error;
  return data?.properties?.action_link;
}

export default {
  fetch: withSupabase({ auth:'user' }, async (req, ctx) => {
    try {
      const callerId = (ctx.userClaims as any)?.sub || (ctx.userClaims as any)?.id;
      const { data: caller } = await ctx.supabaseAdmin.from('admin_users').select('user_id').eq('user_id', callerId).maybeSingle();
      if (!caller) return Response.json({ error:'Admin access required.' }, { status:403 });

      const body = await req.json().catch(() => ({}));
      const action = body.action || 'list';
      const siteUrl = (Deno.env.get('SITE_URL') || 'https://jordanandrochellewedding.netlify.app').replace(/\/+$/, '');

      if (action === 'list') {
        const { data: rows, error } = await ctx.supabaseAdmin.from('admin_users').select('*').order('created_at');
        if (error) throw error;
        const { data: authUsers, error: listError } = await ctx.supabaseAdmin.auth.admin.listUsers({ page:1, perPage:1000 });
        if (listError) throw listError;
        const byId = new Map(authUsers.users.map((u: any) => [u.id, u.email]));
        return Response.json({ admins:(rows || []).map((row: any) => ({ ...row, email:byId.get(row.user_id) || null })) });
      }

      if (action === 'invite') {
        const email = String(body.email || '').trim().toLowerCase();
        const displayName = String(body.display_name || '').trim();
        if (!email || !email.includes('@')) return Response.json({ error:'Enter a valid email address.' }, { status:400 });
        let user = await findAuthUser(ctx.supabaseAdmin, email);
        let createdNew = false;
        if (!user) {
          const { data, error } = await ctx.supabaseAdmin.auth.admin.createUser({ email, password:temporaryPassword(), email_confirm:true, user_metadata:{ display_name:displayName } });
          if (error) throw error;
          user = data.user; createdNew = true;
        }
        const { error: adminError } = await ctx.supabaseAdmin.from('admin_users').upsert({ user_id:user.id, display_name:displayName || email });
        if (adminError) throw adminError;
        try {
          const link = await resetLink(ctx.supabaseAdmin, email, siteUrl);
          if (!link) throw new Error('Could not create password link.');
          await sendEmail(email, 'Wedding Command Center access — Jordan & Rochelle', `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#312a27"><p style="text-transform:uppercase;letter-spacing:.12em;color:#8b6d61">Jordan &amp; Rochelle</p><h1>You’ve been added to the Wedding Command Center</h1><p>Hi ${esc(displayName || email)},</p><p>Use the secure button below to choose your password and sign in to the private Wedding Command Center.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#6e5045;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Choose My Admin Password</a></p><p>If you weren’t expecting this, you can ignore this email.</p></div>`);
        } catch (mailError) {
          if (createdNew) {
            await ctx.supabaseAdmin.from('admin_users').delete().eq('user_id', user.id);
            await ctx.supabaseAdmin.auth.admin.deleteUser(user.id);
          }
          throw mailError;
        }
        return Response.json({ ok:true, user_id:user.id });
      }

      if (action === 'remove') {
        const userId = String(body.user_id || '');
        if (!userId) return Response.json({ error:'Missing administrator.' }, { status:400 });
        if (userId === callerId) return Response.json({ error:'You cannot remove your own administrator access while signed in.' }, { status:400 });
        const { error } = await ctx.supabaseAdmin.from('admin_users').delete().eq('user_id', userId);
        if (error) throw error;
        return Response.json({ ok:true });
      }

      if (action === 'reset') {
        const userId = String(body.user_id || '');
        const { data: userData, error:userError } = await ctx.supabaseAdmin.auth.admin.getUserById(userId);
        if (userError) throw userError;
        const email = userData.user?.email;
        if (!email) return Response.json({ error:'This administrator does not have an email address.' }, { status:400 });
        const link = await resetLink(ctx.supabaseAdmin, email, siteUrl);
        if (!link) throw new Error('Could not create password reset link.');
        await sendEmail(email, 'Reset your Wedding Command Center password', `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#312a27"><p style="text-transform:uppercase;letter-spacing:.12em;color:#8b6d61">Jordan &amp; Rochelle</p><h1>Reset your Command Center password</h1><p>Use this secure link to choose a new password.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#6e5045;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Choose New Password</a></p><p>If you didn’t request this, you can ignore this email.</p></div>`);
        return Response.json({ ok:true });
      }

      return Response.json({ error:'Unknown action.' }, { status:400 });
    } catch (error) {
      console.error(error);
      return Response.json({ error:error instanceof Error ? error.message : 'Administrator request failed.' }, { status:500 });
    }
  })
};
