# Excel's Gallery

A before/after photo-editing gallery for Lightroom Mobile work — Next.js
(App Router) + Supabase (Postgres, Auth, Storage) + Vercel. 

## Reaching the admin studio

There's no visible "Admin" link anywhere in the public nav, on purpose:

- **The URL always works**: go to `/admin/login` (e.g.
  `https://your-site.vercel.app/admin/login`) and sign in. Bookmark it —
  this is the reliable way in.
- There's also a **small, low-opacity dot** in the footer of every public
  page (bottom-right of the footer bar) and one on the welcome screen —
  both link to `/admin/login`. They're deliberately subtle, not a normal
  nav item.

Real security here is Supabase Auth + Row Level Security, not the fact
that the link is hard to spot — see **Security model** below.

## 1. Create a Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New project.
2. Once it's ready, go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon / public key**

   You will *not* need the service-role key anywhere in this app (see
   **Security model**).

## 2. Run the database migration

Dashboard → **SQL Editor → New query** → paste the contents of
`supabase/migrations/0001_init.sql` → Run.

This creates:
- `gallery_projects` and `messages` tables
- Row Level Security policies for both
- A public `gallery` Storage bucket with its own policies
- An `updated_at` trigger

If you'd rather use the Supabase CLI: `supabase db push` after linking
the project, with the migration file in place.

## 3. Create your admin account

There is no public sign-up page anywhere in this app — that's intentional.
Create your one account directly:

Dashboard → **Authentication → Users → Add user** → set an email and
password. That's the account you'll sign in with at `/admin/login`.

## 4. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` variables are
optional — see **Analytics** below. Without them, the admin dashboard's
Analytics panel just says "not connected"; nothing else is affected.

When you deploy, add the same variables in **Vercel → Project → Settings
→ Environment Variables**.

## 5. Run it locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

> I wasn't able to run `npm install` or `next build` myself while writing
> this (this environment has no network access), so the code hasn't been
> compiled or executed anywhere yet. I followed current Next.js 16 /
> React 19 / Supabase patterns carefully, but if something doesn't build
> cleanly on the first try, paste me the error and I'll fix it.

## 6. Deploy to Vercel

1. Push this project to a Git repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo.
3. Add the environment variables from step 4.
4. Deploy.

`next.config.js` derives the allowed image domain from
`NEXT_PUBLIC_SUPABASE_URL` automatically — nothing to edit there when you
change projects.

## 7. Turn on analytics

**Visitor tracking (does the real work):**
Vercel Dashboard → your project → **Analytics** tab → Enable. Free on
Hobby. Nothing to install — `@vercel/analytics` is already wired into
the root layout.

**Admin dashboard panel (optional, reads the numbers back into `/admin`):**
1. Create a token: [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Project Settings → General → copy the **Project ID**
3. Add `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` (and `VERCEL_TEAM_ID` only if
   the project lives under a team) as environment variables
4. This uses Vercel's Web Analytics API — a fairly new addition, so if
   your account doesn't have access yet, the panel degrades gracefully
   to "not connected" rather than breaking the dashboard.
5. Hobby-tier projects retain about a month of analytics history; the
   traffic chart is scoped to the last 30 days for that reason.

## Editing the About page

`src/content/about.js` — not in Supabase, no admin UI, just a plain file:

```js
const about = {
  heading: "About Excel",
  photo: null, // or "/your-photo.jpg" in /public
  paragraphs: ["...", "..."],
  links: [{ label: "GitHub", href: "https://..." }],
};
```

Edit, commit, redeploy.

## Security model

- **No service-role key anywhere.** Every admin action (create, edit,
  delete, image upload) runs through your own signed-in session using
  only the public anon key. What you're allowed to do is enforced by the
  RLS policies in `0001_init.sql`, checked by Postgres itself — not by
  anything in the frontend. There's no public sign-up route, so
  "authenticated" and "you" are the same thing in this app.
- **Two layers of route protection**: `middleware.js` redirects
  signed-out requests away from `/admin` before any page renders, and
  `src/app/admin/(protected)/layout.js` checks again server-side. Even if
  both were somehow bypassed, RLS would still refuse the database write.
- **Messages are write-only for visitors** — anyone can submit the
  contact form, but only your signed-in session can read or delete
  submissions (checked via RLS, not just hidden in the UI).
- **Spam guards on the contact form** are intentionally simple: a
  honeypot field plus a minimum-fill-time check. That stops unsophisticated
  bots, not a determined one — if spam becomes a real problem, adding a
  CAPTCHA (e.g. Cloudflare Turnstile) to `MessageForm.js` /
  `src/lib/actions/message.js` is the natural next step.

## Project structure

```
src/
  app/
    (public)/          gallery, project detail, about, message — shared header/footer layout
    admin/
      login/            public login page (outside the auth guard)
      (protected)/       dashboard — guarded layout + page
      actions.js         create/update/delete post, delete message
    layout.js, globals.css, page.js (welcome screen)
  components/           all UI pieces, public and admin
  lib/
    supabase/            browser + server Supabase clients
    analytics.js          Vercel Web Analytics API wrapper (server-only)
    actions/message.js    contact form server action
    utils.js
  content/about.js        code-editable About content
supabase/migrations/0001_init.sql
```

## What to sanity-check after your first deploy

- Publish a test post end-to-end, then delete it, to confirm Storage
  uploads and RLS are both working.
- Try `/admin` while signed out — should redirect to `/admin/login`.
- Submit the Message form and confirm it shows up under **Messages** in
  `/admin`.
