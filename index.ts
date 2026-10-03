import { withSupabase } from 'npm:@supabase/server@^1'

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    try {
      const { token, action } = await req.json()
      if (!token || !['accepted', 'declined'].includes(action)) {
        return Response.json({ error: 'Invalid response.' }, { status: 400 })
      }

      const tokenHash = await sha256(token)
      const { data: tokenRow, error: tokenError } = await ctx.supabaseAdmin
        .from('job_assignment_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (tokenError) throw tokenError
      if (!tokenRow) return Response.json({ error: 'This response link is invalid.' }, { status: 404 })
      if (tokenRow.used_at) return Response.json({ error: 'This response link has already been used.' }, { status: 409 })
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return Response.json({ error: 'This response link has expired. Please contact Jordan or Rochelle.' }, { status: 410 })
      }

      const { data: assignment, error: assignmentError } = await ctx.supabaseAdmin
        .from('job_assignments')
        .select('*')
        .eq('id', tokenRow.assignment_id)
        .maybeSingle()
      if (assignmentError) throw assignmentError
      if (!assignment) return Response.json({ error: 'Job assignment not found.' }, { status: 404 })

      const { data: job } = await ctx.supabaseAdmin
        .from('wedding_jobs')
        .select('title')
        .eq('id', assignment.job_id)
        .maybeSingle()

      const now = new Date().toISOString()
      const { error: updateError } = await ctx.supabaseAdmin
        .from('job_assignments')
        .update({ status: action, responded_at: now, response_method: 'email' })
        .eq('id', assignment.id)
      if (updateError) throw updateError

      await ctx.supabaseAdmin
        .from('job_assignment_tokens')
        .update({ used_at: now })
        .eq('id', tokenRow.id)

      return Response.json({ ok: true, status: action, job_title: job?.title || 'the wedding job' })
    } catch (error) {
      console.error(error)
      return Response.json({ error: error instanceof Error ? error.message : 'Could not save job response.' }, { status: 500 })
    }
  }),
}
