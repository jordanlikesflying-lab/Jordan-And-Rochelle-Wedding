# Jordan & Rochelle Wedding Manager — Command Center v0.3.0

This release keeps the v0.2.0 RSVP review and invitation tools and adds **Guest Profiles**.

## New in v0.3.0

- Searchable Guest Profiles section
- Profiles for RSVP respondents and invited households that have not responded yet
- Contact information, address, household, RSVP status, party counts, and additional guests in one view
- Edit RSVP and invitation directly from the profile
- Private admin notes stored on the linked invitation
- Wedding job assignment from a guest profile
- Remove job assignments
- Record activity assembled from invitation, RSVP, and assignment timestamps
- Profile buttons directly from the Invite List
- Responsive split-screen layout on desktop and stacked layout on phones

## Existing features

- Live Supabase dashboard
- Split-screen RSVP review
- Suggested invitation matches
- RSVP editing, verification, rejection, and invitation creation
- Invitation add, edit, delete, CSV import, and CSV export
- Wedding jobs
- Toast notifications

## Deploy through GitHub

Copy the **contents of this folder** into the root of the `Jordan-And-Rochelle-Wedding` repository, replacing the existing files. Commit and push to `main`. Netlify should deploy automatically.

Suggested commit message:

```text
Add guest profiles and job assignments v0.3.0
```

## Database

No new tables are required. Guest Profiles use the existing:

- `invitations`
- `rsvps`
- `wedding_jobs`
- `job_assignments`

The configured browser client uses the existing Supabase publishable key. Keep service-role credentials out of this repository.
