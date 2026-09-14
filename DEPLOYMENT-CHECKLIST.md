# Deployment Checklist — Live Scoreboard E-Sport

## GitHub
- Create a NEW repository named `esports-live-scoreboard`.
- Keep RPH Hub untouched.
- Production branch: `main`.

## Supabase
- Create a NEW Supabase project for this app only.
- Region recommended for Malaysia: Singapore (`ap-southeast-1`).
- Run `supabase/schema.sql`.
- Optionally run `supabase/seed.sql` for demo data.
- Create an admin user in Supabase Auth.
- Promote the profile to role `admin`.
- Copy Project URL + publishable key into `config.js`.
- Never put service_role/secret keys in browser code.

## Cloudflare Pages
- Create a NEW Pages project.
- Connect only to the new GitHub repo `esports-live-scoreboard`.
- Production branch: `main`.
- Framework preset: None.
- No build command is required for this static site.
- Output directory: repository root.

## Smoke test
- `/` loads dashboard.
- `/admin.html` requires admin/marshal login when Supabase is configured.
- Add a team and verify it appears publicly.
- Start a match and verify `/live.html` updates without refresh.
- Verify `/overlay.html` updates in OBS Browser Source.
- Finish a group match and verify standings change.
- Verify `/bracket.html` displays knockout matches.

## Cloudflare Free quota guard
- `_routes.json` invokes Pages Functions only for `/api/*`.
- Static HTML/CSS/JS/assets bypass Functions and remain free/unlimited static requests.
- `/api/snapshot` is the only edge function used for public snapshot caching.
- Keep Workers/Pages Functions on Free; do not upgrade automatically.
- Set Runtime fail mode to **Fail open** so static scoreboard pages still load if the daily Functions quota is exhausted.
