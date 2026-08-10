# v0.6.3 Email + Job Response Setup

This release adds RSVP acknowledgement emails and email-based wedding-job requests.

## 1. Run the SQL migration

In Supabase > SQL Editor, run:

`v0.6.3-email-jobs-gallery.sql`

Run it once.

## 2. Create a Resend account and verify a sender domain

Resend requires a verified sender domain before you can send normal production email to wedding guests.

A Netlify `*.netlify.app` hostname is not your own DNS domain, so for production sending use a domain/subdomain you control.

Example sender:

`Jordan & Rochelle <wedding@updates.yourdomain.com>`

## 3. Add Edge Function secrets

In Supabase > Edge Functions > Secrets, add:

- `RESEND_API_KEY` = your Resend API key
- `EMAIL_FROM` = your verified From address, e.g. `Jordan & Rochelle <wedding@updates.yourdomain.com>`
- `EMAIL_REPLY_TO` = optional address where replies should go
- `SITE_URL` = `https://jordanandrochellewedding.netlify.app`

Do **not** put the Resend API key in `config.js`, GitHub, or Netlify public files.

## 4. Deploy the three Edge Functions

This ZIP includes:

- `supabase/functions/send-rsvp-confirmation`
- `supabase/functions/send-job-request`
- `supabase/functions/job-response`

If your repository is linked to your Supabase project with the CLI:

```bash
supabase functions deploy send-rsvp-confirmation --no-verify-jwt
supabase functions deploy send-job-request
supabase functions deploy job-response --no-verify-jwt
```

Or create/deploy equivalent functions from the Supabase Dashboard.

## 5. Test

### RSVP acknowledgement
Submit a test RSVP with your own email address. The RSVP must save even if email delivery fails.

### Wedding job email
In Command Center > Wedding Jobs:
1. Assign a named person.
2. Choose **Send email request and wait for response**.
3. Confirm the email arrives.
4. Open the response page and Accept.
5. Refresh Command Center and verify the assignment says Accepted.

You can also click **Mark Accepted** or **Mark Declined** in Command Center when someone answers by phone, text, or in person.


## v0.7.0 administrator settings

Settings includes secure administrator invitations and password-reset emails. Deploy one additional authenticated Edge Function:

```bash
supabase functions deploy manage-admin-users
```

If using the Supabase Dashboard editor, create a function named `manage-admin-users` and paste the contents of `supabase/functions/manage-admin-users/index.ts`. Leave JWT verification ON for this function.


## v0.7.1 gift-claim confirmation function

v0.7.1 adds one optional Edge Function using the same Resend secrets you already configured:

`send-gift-claim-confirmation`

Deploy it from Supabase Edge Functions and turn **Verify JWT / legacy JWT verification OFF** for this function, because a guest can claim a gift without signing in.

No new email secrets are required.
