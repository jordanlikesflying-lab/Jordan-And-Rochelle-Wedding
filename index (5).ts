import { withSupabase } from 'npm:@supabase/server@^1'
import { emailShell, htmlEscape, sendEmail } from '../_shared/email.ts'

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    try {
      const { rsvp_id } = await req.json()
      if (!rsvp_id) return Response.json({ error: 'Missing RSVP id.' }, { status: 400 })

      const { data: rsvp, error } = await ctx.supabaseAdmin
        .from('rsvps')
        .select('*')
        .eq('id', rsvp_id)
        .maybeSingle()

      if (error) throw error
      if (!rsvp) return Response.json({ error: 'RSVP not found.' }, { status: 404 })
      if (!rsvp.email) return Response.json({ ok: true, skipped: 'no_email' })
      if (rsvp.confirmation_email_sent_at) return Response.json({ ok: true, skipped: 'already_sent' })

      // Only allow the automatic acknowledgement shortly after a public RSVP is created.
      const created = new Date(rsvp.created_at).getTime()
      if (!Number.isFinite(created) || Date.now() - created > 30 * 60 * 1000) {
        return Response.json({ error: 'This RSVP is too old for an automatic acknowledgement.' }, { status: 409 })
      }

      const { data: people } = await ctx.supabaseAdmin
        .from('rsvp_people')
        .select('person_name, person_type, sort_order')
        .eq('rsvp_id', rsvp.id)
        .order('sort_order')

      const names = (people || []).map((p: any) => p.person_name).filter(Boolean)
      const attendanceText = rsvp.attendance === 'attending'
        ? 'We’re so happy you’re planning to celebrate with us!'
        : 'Thank you for letting us know. We’ll miss celebrating with you.'

      const peopleHtml = names.length
        ? `<p><strong>People on this RSVP:</strong><br>${names.map((n: string) => htmlEscape(n)).join('<br>')}</p>`
        : ''

      await sendEmail({
        to: rsvp.email,
        subject: 'We received your RSVP — Jordan & Rochelle',
        html: emailShell(`
          <h1 style="font-size:28px;margin:18px 0 12px">Thanks, ${htmlEscape(rsvp.first_name)}!</h1>
          <p>${attendanceText}</p>
          <p>We received your RSVP for our wedding on <strong>November 14, 2026</strong> at the 4-H Building in Milbank, South Dakota.</p>
          ${peopleHtml}
          <p>If anything changes, please contact Jordan or Rochelle and we can update it.</p>
        `)
      })

      await ctx.supabaseAdmin
        .from('rsvps')
        .update({ confirmation_email_sent_at: new Date().toISOString() })
        .eq('id', rsvp.id)

      return Response.json({ ok: true })
    } catch (error) {
      console.error(error)
      return Response.json({ error: error instanceof Error ? error.message : 'Email failed.' }, { status: 500 })
    }
  }),
}
