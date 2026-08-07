# Jordan & Rochelle Wedding Manager — Command Center v2

This release uses the configured Supabase project and includes:

- Live dashboard totals
- Split-screen RSVP review
- Suggested invitation matches
- RSVP editing, verification, rejection, and invitation creation
- Invitation add, edit, and delete
- Invitation CSV import and export
- Wedding jobs
- Toast notifications

## Deploy through GitHub

Copy the files in this folder into the root of the `Jordan-And-Rochelle-Wedding` repository, replacing the existing files. Commit and push to `main`. Netlify will deploy automatically.

Suggested commit message:

```text
Add RSVP review and invitation management v0.2.0
```

## CSV import columns

The first row must contain these required columns:

```text
household_name,primary_first_name,primary_last_name
```

Optional columns:

```text
street_address,city,state,zip_code,phone,email,max_guests,status,private_notes
```

Valid status values are `invited`, `responded`, `declined`, and `cancelled`.
