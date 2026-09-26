# SHARK TEAM Admin / CMS — Step 13

## Goal

The owner must be able to operate and expand SHARK TEAM without editing application code.

The admin uses the same PostgreSQL source of truth as the public site, booking, Payme, CRM, coach dashboard and Telegram assistant.

## Admin sections

- Dashboard
- Leads
- Trials
- Parents
- Children
- Payments
- Sports
- Branches
- Coaches
- Groups
- Prices
- Content
- FAQ
- Media
- Audit history

## Expansion workflow

A new branch can be launched without a code change:

1. Create Sport if it does not exist.
2. Create Branch in Draft.
3. Create Coach.
4. Create Group and select Branch + Sport + Coach.
5. Group creation automatically creates BranchSport, CoachSport and CoachBranch relations.
6. Configure schedule and capacities.
7. Activate Group and open enrollment.
8. Backend generates future TrainingSession rows.
9. Create current Price versions.
10. Upload media.
11. Activate Branch.

Active branches with active groups appear automatically at:

`/[locale]/branches`

Each active branch automatically has:

`/[locale]/branches/[slug]`

## Branch management

Editable:

- public RU/UZ names
- status
- district
- RU/UZ address
- postal code
- RU/UZ landmark
- coordinates
- public phone
- working hours
- entrance instructions
- facility notes

New branches start as Draft unless explicitly activated.

## Coach management

Editable:

- status
- first and last name
- private phone
- experience
- RU/UZ education
- RU/UZ qualification
- RU/UZ public bio

Coach private phone is operational data and is not rendered publicly.

## Group management

A group is connected to:

- Branch
- Sport
- primary Coach
- age range
- regular capacity
- trial capacity
- enrollment status
- recurring schedule

Changing a schedule regenerates future Sessions only when there are no future TrialBooking records that would be invalidated.

Past Sessions remain historical.

A new group starts as Draft/Paused by the UI. It should be reviewed before public enrollment is opened.

## Prices

Price edits are versioned.

Creating a new Price:

- closes the previous active matching price with validTo;
- creates a new active Price version;
- does not rewrite existing Payment amounts.

The website, Telegram assistant and future bookings read current Price records from PostgreSQL.

## Content

The Home ContentPage controls:

- RU/UZ hero eyebrow
- RU/UZ H1
- RU/UZ lead
- RU/UZ SEO title
- RU/UZ SEO description
- Draft / Published / Archived state

Published content is rendered on the public homepage.

If content is missing, the application uses safe built-in launch copy rather than inventing database content.

## FAQ

FAQ items support:

- RU question
- UZ question
- RU answer
- UZ answer
- Branch scope
- Sport scope
- sort order
- Draft / Published / Archived state

Only Published FAQ is rendered publicly.

## Media

Storage provider: Vercel Blob.

Production environment:

```
BLOB_READ_WRITE_TOKEN=
MEDIA_DRY_RUN=false
```

Supported MVP file types:

- JPEG
- PNG
- WebP
- AVIF
- MP4
- WebM

Maximum file size: 20 MB.

Media can target:

- Branch
- Coach
- Sport
- Group
- Page

Categories include:

- main
- facade
- entrance
- hall
- training
- equipment
- coach profile
- other

### Minor consent rule

When containsMinors=true:

- APPROVED can be published;
- anything else is forced to PENDING.

Public queries return only:

- media without minors; or
- minor media with APPROVED consent.

PENDING or REJECTED child media never appears on public pages.

## Audit

Admin mutations write AuditLog with:

- actor
- action
- entity type
- entity id
- before JSON
- after JSON
- timestamp

The admin UI does not expose an audit-log clear operation.

## Public branch rendering

The public site no longer requires one source file per branch.

The route:

`/[locale]/branches/[slug]`

loads Branch, Groups, Sports, Coaches, Schedule, Prices and consent-safe media from PostgreSQL.

## CI acceptance test

The CMS smoke flow performs real authenticated API calls and verifies:

1. create a new Sport;
2. create a Draft Branch;
3. create a Coach;
4. edit Branch and Coach;
5. create a Group;
6. activate the Group and its schedule;
7. generate future Sessions;
8. create a Price version;
9. create Published FAQ;
10. publish new homepage hero/SEO;
11. upload consent-safe media;
12. upload minor media with pending consent;
13. verify AuditLog;
14. verify new Branch in admin;
15. verify new Branch in public branch catalog;
16. verify the dynamic public Branch URL;
17. verify published homepage CMS;
18. verify safe media is public;
19. verify pending minor media is not public.

CI uses MEDIA_DRY_RUN=true and never writes a real Blob.
