# v0.6.1 Quick Patch — Homepage Engagement Photo

This patch adds a **Set as Homepage Favorite** button in Photo Manager. The selected photo replaces the `Your favorite engagement photo` placeholder on the public Home page. It does **not** have to be part of the guest album.

Before deploying, run `v0.6.1-homepage-favorite-photo.sql` once in the Supabase SQL Editor. Then upload/commit the files as usual.

---

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

## v0.5.0 — Wedding Jobs

This release adds a complete Wedding Jobs workspace to the private Command Center:

- Add and edit wedding jobs
- Set number of people needed, location, start time, and instructions
- Mark jobs as available for volunteers
- Assign guests or households directly from a job
- Prevent duplicate assignments to the same job
- Remove individual job assignments
- See filled vs. still-needed positions
- Search jobs
- Delete jobs, with an explicit warning when assignments will also be removed
- Dashboard attention count now reflects genuinely unfilled job positions

No new Supabase tables are required. This release uses the existing `wedding_jobs` and `job_assignments` tables.


## v0.5.0 — Registry Manager

- Add, edit, hide/show, reorder, and delete registry items.
- Preview the public registry from the Command Center.
- The public Gift Registry page now loads only active items from Supabase.
- No database schema changes are required if your existing `registry_items` table matches the project schema.

## v0.6.0 — Photo Manager

This release adds the private photo library and curated public guest album.

Before using Photo Manager, run `v0.6.0-photo-security.sql` once in the Supabase SQL Editor. This changes the `wedding-photos` Storage bucket from public to private. The existing Storage RLS policies then allow only selected guest-album photos to be read by public visitors, while admins can manage the full library.

Photo Manager supports multi-photo upload, captions, guest-album visibility, ordering, preview, and permanent deletion from both Storage and the `photos` table.


## v0.6.2
Run `v0.6.2-planning-polish.sql` once in Supabase before deploying.
Adds named RSVP attendees (including children), Excel/CSV invitation import, gift-list import,
public Main Menu buttons, registry links, and editable wedding details/map settings.


## v0.6.3

Run `v0.6.3-email-jobs-gallery.sql` once.

New in this patch:
- fixes Excel/XLSX importing in the Command Center
- RSVP acknowledgement email support
- individual household people can receive wedding jobs
- emailed job requests with secure Accept/Decline links
- admin-side Mark Accepted / Mark Declined
- resend job request emails
- more reliable public gallery and homepage favorite photo loading
- `EMAIL-AND-FUNCTIONS-SETUP.md` contains the one-time email setup


## v0.7.0 — Settings

Run `v0.7.0-settings.sql` once before deploying.

Settings now controls:
- couple names, wedding date and ceremony time
- venue name/address/city/state
- homepage welcome heading and message
- editable Wedding Details and map search
- RSVP open/closed with database enforcement
- Gift Registry and Photo Album visibility
- Amazon and other registry links
- private administrator list and password handling

For Add Administrator / password-reset buttons, deploy the included `manage-admin-users` Edge Function.


## v0.7.1

Run `v0.7.1-registry-and-merge.sql` once before deploying.

Changes:
- RSVP Review now has separate **Needs Review** and **Reviewed RSVPs** views.
- New side-by-side RSVP → invitation merge tool.
- Duplicate invitation households can be merged safely; linked RSVPs/jobs move with them.
- The optional second registry button appears only when a valid second URL is saved.
- Wedding gift items can be claimed without accounts or passwords.
- Claimant name/email are private; other guests only see **Claimed**.
- Guests can buy claimed gifts anywhere they want.
- If a claimant gives an email, the optional `send-gift-claim-confirmation` function emails a private release link.
- Command Center shows who claimed a gift and can release the claim manually.


## v0.7.2

Run `v0.7.2-duplicate-rsvp-cleanup.sql` once.

Changes:
- Adds **Delete Duplicate RSVP** to Reviewed RSVPs.
- Deleting an RSVP never deletes the invitation household.
- Named RSVP people are removed with the duplicate RSVP.
- Deletion is blocked when wedding-job assignments still reference that RSVP.
- Invitation status is recalculated after deletion.
- Permanently includes the v0.7.1 invitation-status enum merge fix.


## v0.8.0 — Wedding Summary

No SQL migration is required for this release.

Wedding Summary now includes:
- invited household and invited-capacity totals
- verified attending adults and children
- declined RSVP and review counts
- RSVP household-response progress
- unfilled wedding-job positions
- job requests awaiting responses
- accepted assignment count
- available / claimed / hidden gift totals
- private photo-library and guest-album counts
- homepage-favorite status
- public-site visibility checks for RSVP, registry, album, details, and map
- a single **What Still Needs Attention?** section linking directly to the relevant Command Center page


## v0.9.0 — Final Polish & Testing

No SQL migration is required.

This release intentionally adds no new wedding-planning features. It focuses on:
- cache-busting `app.js`, `styles.css`, and `config.js` so new Netlify deploys do not keep showing an older file
- no-store handling for private token-response pages and config
- improved phone/tablet layouts and touch targets
- better mobile keyboard/autofill hints for RSVP and claim forms
- keyboard focus styling and Escape-to-close for Command Center/guest modals
- reduced-motion support
- safer external-link referrer behavior
- final regression checklist before v1.0.0

See `v0.9.0-FINAL-TEST-CHECKLIST.md`.


## v0.9.1 — Public RSVP RLS Hotfix

No SQL migration is required.

Fixes public RSVP submission failing with:
`new row violates row-level security policy for table "rsvps"`

The guest RSVP form now uses the existing `submit_public_rsvp` database RPC instead of attempting a direct insert into the protected RSVP table. Named attendee rows are still stored in `rsvp_people`, and RSVP confirmation email behavior is unchanged.


## v0.9.2 — Installable Phone App

No SQL migration is required.

- Public wedding site can be added to a phone home screen.
- Wedding Command Center can be installed separately from its own page and reopens directly to the private Command Center.
- Standalone app-style display.
- Custom Jordan & Rochelle home-screen icon.
- iPhone/iPad Apple touch icon support.
- Android/Chrome manifest and service-worker support.
- Network-first service worker to avoid stale deployed files.


## v1.0.0 — Wedding Ready

This is the first production-ready release of the Jordan & Rochelle Wedding Manager.

No database migration is required when upgrading from v0.9.2.

v1.0.0 promotes the fully tested v0.9.2 build without adding new functionality. The tested release includes:

- public wedding website
- RSVP submission with named adults and children
- RSVP review, matching, merging, verification, and safe duplicate deletion
- invitation list and guest profiles
- Wedding Jobs assignments, email requests, and Accept/Decline responses
- claim-a-gift registry with secure release links
- private photo library, guest album, and homepage favorite
- Wedding Summary dashboard
- editable Settings and guest-site visibility controls
- responsive mobile layouts
- installable Android/iPhone home-screen web app support
- separate installable Wedding Command Center
- cache-busting and network-first service-worker behavior
- final regression testing completed before promotion

### Release status

**Wedding Ready — v1.0.0**


## v1.0.1 — Invitation People

Run `v1.0.1-invitation-people.sql` before deploying.

- `John and Joe Weaver` stays the household name.
- Automatically creates `John Weaver` and `Joe Weaver` as separate invited people.
- Supports `John & Joe Weaver` and `John Weaver and Joe Smith`.
- Existing invitations are backfilled by the SQL migration.
- Guest Profiles show people on an invitation before RSVP.
- Wedding Jobs can select each invited person separately before RSVP.
- Excel/CSV import preserves Household Name when provided.


### v1.0.1 revised additions

This package supersedes the earlier v1.0.1 package if it has not yet been deployed.

- possible duplicates are flagged in Invite List, RSVP Review, and Guest Profiles
- duplicate checks compare household/name plus matching phone/email, and multiple RSVPs linked to the same invitation
- flags are warnings only; nothing is automatically deleted or merged
- Edit RSVP now includes a named-person editor for every adult and child
- older RSVPs without `rsvp_people` rows are prefilled from the primary guest and legacy Additional Guests text where possible
- saving preserves existing RSVP-person IDs where possible so Wedding Job links remain intact
- after saving an old RSVP, each named person becomes selectable individually for Wedding Jobs


### v1.0.1 final additions

- Wedding Jobs flag likely duplicate job records.
- Gift Registry flags likely duplicate gift records.
- Registry items have a Quantity Wanted field.
- Guests claim one unit at a time.
- Multiple guests can safely claim the same gift until the requested quantity is reached.
- Each guest claim has its own private release token.
- Admin can release individual claims without releasing everyone else's claim.
- Excel/CSV gift import supports optional Quantity / Qty / Quantity Wanted columns.


## v1.0.2 — Select People Inside a Household

No SQL migration is required when upgrading from v1.0.1-final.

Guest Profiles now keeps each household together while showing every named person underneath it. Selecting a person focuses the detail panel on that individual, shows that person's Wedding Jobs, and preselects that person when assigning a job.


## v1.0.3 — Invitation Duplicate Fix

No SQL required.

- Invitations are now flagged whenever another invitation has the same Primary First Name + Primary Last Name.
- The Invite List Actions column is restored.
- Profile, Edit, and Delete buttons are restored on invitation rows.


## v1.0.4 — Household Person Duplicate Detection

No SQL required.

Duplicate invitation detection now compares every individual named person in each household. A duplicate is flagged even when the matching person is not the primary contact.


## v1.0.5 — Household People & Duplicate Review

Run `v1.0.5-household-people-and-duplicate-review.sql` before deploying.

- Review a possible duplicate and mark a pair **Not a duplicate**; the dismissal is saved in Supabase.
- Edit every named person inside an invitation household.
- Add additional adults or children.
- Remove household members.
- The household label remains independent from the individual names.
- The first adult becomes the stored primary contact name for RSVP matching and existing workflows.


## v1.0.6 — Persistent Duplicate Review Fix

No SQL required. Saved **Not a duplicate** decisions are loaded with the initial Command Center data, preventing duplicate warnings from returning after a browser refresh.
