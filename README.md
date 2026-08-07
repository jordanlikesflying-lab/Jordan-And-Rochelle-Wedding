# Jordan & Rochelle Wedding App — Command Center v1

This build connects the public RSVP form and private Wedding Command Center to the existing Supabase tables.

## Included in this build

- Public RSVP submissions insert into `rsvps` as `needs_review`
- Private email/password login at `/command-center.html`
- Live dashboard totals
- Private wedding countdown
- RSVP review queue
- Match an RSVP to an existing invitation
- Verify without matching
- Create an invitation from an RSVP
- Reject an RSVP
- Searchable invite list
- Add invitation form
- Wedding jobs list and add-job form
- Mobile Command Center navigation

## Deploying the update

1. Copy your existing Supabase URL and publishable/anon key into `config.js`.
2. Test locally:

```bash
python -m http.server 8080
```

3. Open the public site at `http://localhost:8080/`.
4. Open the private site at `http://localhost:8080/command-center.html`.
5. Upload the **contents of this folder** to the same Netlify site to replace the prior version.

## Security

The browser uses only the Supabase publishable/anon key. Do not place a service-role key in `config.js`.

The public RSVP insert depends on the anonymous `INSERT` policy already added to `rsvps`. Admin reads and changes depend on the `is_admin()` RLS policies and membership in `admin_users`.

## Important test

1. Submit a test RSVP on the public page.
2. Sign into the private Command Center.
3. Open **RSVP Review**.
4. Match, verify, or reject the test response.
