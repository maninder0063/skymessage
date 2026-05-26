# SkyMessage — Morning Playbook (80 friends today)

Hi. Everything that *can* be ready without your accounts is ready. Your job
this morning: create three free cloud accounts, copy a few keys around, run
two scripts, share two links. Estimated time: **45–60 minutes**.

---

## What's already done (no action needed)

- Full monorepo at `skymessage/` — web + server + desktop + shared packages
- Supabase migrations (users, messages, blocked, settings, devices, rate_limits)
  with RLS policies and the auth-trigger that auto-creates profiles
- Email/password auth wired across all three apps (sign up on web, sign in on
  desktop — same credentials)
- Online/offline indicator on every profile page (5-min heartbeat threshold)
- Hono API with anti-spam, profanity filter, rate limits
- Next.js 15 + MUI v7 landing, profile, send composer, `/download`, `/account`
- Electron overlay with the same plane.png + banner.png from
  `meeting-plane-electron` (WAAPI sweep, cloth flutter)
- **A working portable Windows app already built at:**
  ```
  skymessage/apps/desktop/release/SkyMessage-Win64.zip   (~110 MB)
  ```
  ⚠ This zip points at placeholder URLs. You'll rebuild after step 2 below
  with your real hosted URLs baked in — takes 30 seconds.

---

## Step 1 — Create three free accounts (~10 min)

Sign up at:

| Service       | URL                                  | What you'll need from it          |
| ------------- | ------------------------------------ | --------------------------------- |
| **Supabase**  | https://supabase.com/dashboard       | `URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` |
| **Fly.io**    | https://fly.io/app/sign-up           | account + `fly` CLI logged in     |
| **Vercel**    | https://vercel.com/signup            | account + `vercel` CLI logged in  |

Install the CLIs locally if you don't have them:

```powershell
npm i -g supabase vercel
iwr https://fly.io/install.ps1 -useb | iex    # Fly CLI
```

Then log into each:

```powershell
supabase login
fly auth login
vercel login
```

---

## Step 2 — Create the Supabase project + apply schema (~5 min)

1. In the Supabase dashboard, click **New project**, name it `skymessage`,
   pick the region closest to your friends, set a strong DB password.
2. Wait ~90 seconds for it to provision.
3. From **Project Settings → API**, copy:
   - `Project URL`              → goes into env as `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key          → `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `DESKTOP_SUPABASE_ANON_KEY`
   - `service_role` key (secret) → `SUPABASE_SERVICE_ROLE_KEY` (server only!)
4. From **Authentication → Providers → Email**, **turn OFF "Confirm email"**
   so your friends can sign in immediately without a confirmation link.
5. Link the local project and push the schema:
   ```powershell
   cd C:\Users\manin\OneDrive\Desktop\app idea\skymessage
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   ```

Done — your DB is live.

---

## Step 3 — Deploy the API server to Fly.io (~10 min)

1. Edit `apps/server/fly.toml` and change `app = "skymessage-server"` to a
   unique name (e.g. `app = "skymessage-yourname"`). The Fly URL becomes
   `https://skymessage-yourname.fly.dev`.

2. From the repo root:
   ```powershell
   cd apps\server
   fly launch --no-deploy --copy-config --name skymessage-yourname
   fly secrets set `
     SUPABASE_URL="https://YOUR-REF.supabase.co" `
     SUPABASE_SERVICE_ROLE_KEY="eyJh..." `
     ALLOWED_ORIGINS="https://your-vercel-app.vercel.app,app://skymessage"
   fly deploy --remote-only
   ```

3. Verify:
   ```powershell
   curl https://skymessage-yourname.fly.dev/api/health
   # → {"status":"ok",...}
   ```

If Fly complains about the Dockerfile path, copy it once to the repo root:
```powershell
Copy-Item apps\server\Dockerfile Dockerfile -Force
```
Then re-run `fly deploy`.

---

## Step 4 — Deploy the web to Vercel (~10 min)

```powershell
cd C:\Users\manin\OneDrive\Desktop\app idea\skymessage\apps\web
vercel link                       # link to a new project named "skymessage"
vercel env add NEXT_PUBLIC_API_BASE_URL          production
   # paste: https://skymessage-yourname.fly.dev
vercel env add NEXT_PUBLIC_SITE_URL              production
   # paste: https://skymessage-yourname.vercel.app   (you can change later if you buy a domain)
vercel env add NEXT_PUBLIC_SUPABASE_URL          production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY     production
vercel --prod
```

Note the production URL Vercel prints — that's the link you'll share for
sign-ups and `/send/...` pages.

Go back to Fly and **update `ALLOWED_ORIGINS`** with the real Vercel URL:

```powershell
cd ..\server
fly secrets set ALLOWED_ORIGINS="https://your-real.vercel.app,app://skymessage"
fly deploy
```

---

## Step 5 — Rebuild the desktop installer with real URLs (~3 min)

The portable zip already in `release/` points at placeholders. Rebuild it
with your real URLs so friends' installs actually connect:

```powershell
cd C:\Users\manin\OneDrive\Desktop\app idea\skymessage
$env:DESKTOP_API_BASE_URL       = "https://skymessage-yourname.fly.dev"
$env:DESKTOP_SUPABASE_URL       = "https://YOUR-REF.supabase.co"
$env:DESKTOP_SUPABASE_ANON_KEY  = "eyJh..."   # the anon public key, NOT service_role
node apps\desktop\package-portable.mjs
Compress-Archive -Path apps\desktop\release\SkyMessage-portable `
                 -DestinationPath apps\desktop\release\SkyMessage-Win64.zip -Force
```

Output: `apps\desktop\release\SkyMessage-Win64.zip` (~110 MB).

### Where to host this for 80 friends to download

| Option        | Best for                                | Setup time |
| ------------- | --------------------------------------- | ---------- |
| **GitHub Releases** | Permanent home, free, direct link   | 5 min      |
| **Dropbox**         | Right-click → "Copy link"           | 1 min      |
| **Google Drive**    | Same — share link, "Anyone with"    | 1 min      |
| **Vercel static**   | Put in `apps/web/public/` and link  | 0 min (already deployed) |

Easiest for tonight: drag the zip into Dropbox/GDrive, copy the share link,
then in Vercel:

```powershell
vercel env add NEXT_PUBLIC_DOWNLOAD_WIN_URL production
   # paste: https://your.dropbox.com/...  (or https://drive.google.com/...)
vercel --prod
```

Now `https://your.vercel.app/download` shows a working "Download .exe" button.

---

## Step 6 — Test it yourself end-to-end (~5 min)

1. Visit `https://your.vercel.app/auth/signup`, sign up as yourself.
2. You're redirected to `/account` showing your `@handle` and share link.
3. Visit `https://your.vercel.app/download`, download the zip.
4. Extract, double-click `SkyMessage.exe`.
5. The login window opens. Sign in with the same email/password.
6. The window closes. SkyMessage is now in your system tray.
7. Lock your PC (Win+L) and unlock — a banner with whatever message you sent
   yourself from the web should fly across the screen.
8. Right-click the tray icon → **Check for messages now** triggers it without
   locking, useful for friends to test instantly.

---

## Step 7 — Send to 80 friends (~5 min)

Compose one short message to your group chat / email:

> *Try SkyMessage — it's like getting a paper-airplane note from a friend,
> but on your desktop. Sign up at https://your.vercel.app/signup and grab
> the Windows app at https://your.vercel.app/download. Send me a banner at
> https://your.vercel.app/send/yourhandle and I'll send one back.*

When your friends sign up, their profile pages live at
`https://your.vercel.app/<their-handle>`. Anyone (even without an account)
can send to anyone via the public composer.

---

## Limits to mention to friends

- **Max 80 chars** per message
- **Max 3 messages/day** to the same person from the same sender
- **Max 5 unread queued** at a time
- Banners only animate on unlock, resume from sleep, or 5+ min idle return —
  never during focused work
- Profanity filter is on by default; quiet hours can be configured per user

---

## If something breaks

| Symptom                                          | Where to look                                              |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Web throws 500 on signup                         | `vercel logs` — most likely missing env var                |
| Login works on web, fails on desktop with "Invalid session" | `DESKTOP_SUPABASE_URL/ANON_KEY` mismatch — rebuild zip |
| Desktop says "Auth user has no SkyMessage profile" | They signed up via desktop with email-confirm ON. Either: (a) turn off email confirm in Supabase, or (b) tell them to sign up via the website instead. |
| "Origin not allowed" in API logs                 | Add the Vercel URL to `ALLOWED_ORIGINS` and redeploy Fly  |
| Plane doesn't appear after unlock                | Right-click tray → "Show logs folder" → `main.log`         |
| API healthcheck times out                        | `fly logs` to see the Hono boot output                     |

---

## Cost summary

Everything you spin up tonight is **$0/month** at this scale. You'll start
paying when:

- Supabase: 500 MB DB used (~5–10k users) → $25/mo Pro
- Fly: ~1 GB-hour/day exceeded (~1k concurrent desktops polling) → $5/mo small VM
- Vercel: 100 GB bandwidth/mo (~10k visitors) → $20/mo Pro

Realistically: $0 for the first month, ~$25/mo when you cross ~500 active
users. Plenty of runway for 80 friends.

---

## Where things live in the repo

```
skymessage/
├── apps/
│   ├── web/         Next.js — signup, login, profile, send, download, account
│   ├── server/      Hono API — Fly deploy via apps/server/fly.toml
│   └── desktop/     Electron + PixiJS-less PNG plane (meeting-plane visuals)
│       └── release/SkyMessage-Win64.zip    ← the artifact to share
├── packages/        types, shared (validation/profanity/anti-spam), ui (MUI atoms)
├── supabase/        config.toml, migrations (initial schema + auth trigger), seed.sql
├── deploy.ps1       convenience runner — `.\deploy.ps1 all`
├── .env.example     all env vars in one place
├── README.md
├── ARCHITECTURE.md
├── DEPLOYMENT.md
└── MORNING_PLAYBOOK.md   (this file)
```

Good luck. Wake up, run the steps in order, and message me back when it's
live for your friends. — me, last night
