import { withSupabase } from 'npm:@supabase/server@^1'
import { emailShell, htmlEscape, sendEmail } from '../_shared/email.ts'

function tokenValue() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      const userId = (ctx.userClaims as any)?.sub || (ctx.userClaims as any)?.id
      const { data: admin } = await ctx.supabaseAdmin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
      if (!admin) return Response.json({ error: 'Admin access required.' }, { status: 403 })

      const { assignment_id } = await req.json()
      if (!assignment_id) return Response.json({ error: 'Missing assignment id.' }, { status: 400 })

      const { data: assignment, error: assignmentError } = await ctx.supabaseAdmin
        .from('job_assignments')
        .select('*')
        .eq('id', assignment_id)
        .maybeSingle()
      if (assignmentError) throw assignmentError
      if (!assignment) return Response.json({ error: 'Assignment not found.' }, { status: 404 })
      if (!assignment.contact_email) return Response.json({ error: 'Add an email address before sending the request.' }, { status: 400 })

      const { data: job, error: jobError } = await ctx.supabaseAdmin
        .from('wedding_jobs')
        .select('*')
        .eq('id', assignment.job_id)
        .maybeSingle()
      if (jobError) throw jobError
      if (!job) return Response.json({ error: 'Wedding job not found.' }, { status: 404 })

      // Expire any previous unused link for this assignment.
      await ctx.supabaseAdmin
        .from('job_assignment_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('assignment_id', assignment.id)
        .is('used_at', null)

      const token = tokenValue()
      const tokenHash = await sha256(token)
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { error: tokenError } = await ctx.supabaseAdmin
        .from('job_assignment_tokens')
        .insert({ assignment_id: assignment.id, token_hash: tokenHash, expires_at: expires })
      if (tokenError) throw tokenError

      const siteUrl = (Deno.env.get('SITE_URL') || 'https://jordanandrochellewedding.netlify.app').replace(/\/+$/, '')
      const responseUrl = `${siteUrl}/job-response.html?token=${encodeURIComponent(token)}`
      const startText = job.starts_at
        ? new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Chicago' }).format(new Date(job.starts_at))
        : 'Time will be coordinated with Jordan and Rochelle.'

      try {
        await sendEmail({
          to: assignment.contact_email,
          subject: `Wedding job request: ${job.title}`,
          html: emailShell(`
            <h1 style="font-size:27px;margin:18px 0 12px">Could you help with ${htmlEscape(job.title)}?</h1>
            <p>Hi ${htmlEscape(assignment.person_name)},</p>
            <p>Jordan and Rochelle would like to ask if you can help with this wedding job.</p>
            <p><strong>Job:</strong> ${htmlEscape(job.title)}<br>
            <strong>When:</strong> ${htmlEscape(startText)}<br>
            ${job.location ? `<strong>Location:</strong> ${htmlEscape(job.location)}<br>` : ''}
            ${assignment.instructions ? `<strong>Instructions:</strong> ${htmlEscape(assignment.instructions)}` : ''}</p>
            <p style="margin:26px 0">
              <a href="${responseUrl}" style="display:inline-block;background:#6e5045;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">Respond to Job Request</a>
            </p>
            <p>You can accept or decline on the response page. If you prefer, you can also call or text Jordan or Rochelle and they can confirm it for you.</p>
          `)
        })
      } catch (emailError) {
        await ctx.supabaseAdmin.from('job_assignment_tokens').delete().eq('token_hash', tokenHash)
        throw emailError
      }

      await ctx.supabaseAdmin.from('job_assignments').update({
        status: 'awaiting_response',
        requested_at: new Date().toISOString(),
        responded_at: null,
        response_method: null,
      }).eq('id', assignment.id)

      return Response.json({ ok: true })
    } catch (error) {
      console.error(error)
      return Response.json({ error: error instanceof Error ? error.message : 'Could not send job request.' }, { status: 500 })
    }
  }),
}
