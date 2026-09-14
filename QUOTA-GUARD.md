# Zero-cost quota guard

This project is designed to keep Supabase egress and Storage usage extremely low.

## Hard design rules

1. Supabase Storage is not used by the scoreboard. Keep bucket count at 0.
2. Supabase stores only small relational records: tournaments, teams, players, matches, scores and audit logs.
3. Public assets (HTML/CSS/JS/images/fonts) are served by Cloudflare Pages/CDN.
4. If dynamic logo uploads are added later, use Cloudflare R2 Standard only, not Supabase Storage.
5. Public initial scoreboard reads prefer `/api/snapshot`, a Cloudflare Pages Function with edge caching.
6. Live score updates use Supabase Realtime row deltas and patch in-memory state. They must not trigger full bundle refetches.
7. Standings are calculated in the browser from teams + finished group matches, avoiding a separate standings download.
8. Database selects request explicit columns only; never use `select('*')` on public live pages.

## Internal soft budgets

- Supabase Storage: 0 MB target.
- Supabase egress for this scoreboard: 250 MB/month target.
- Cloudflare R2: 500 MB internal target if dynamic logo uploads are enabled later.
- Team logo target: <= 250 KB each.
- Banner/background target: <= 1 MB each and preferably WebP/AVIF.

These are application-level safety budgets, not provider-side billing caps.

## Cloudflare edge cache

`functions/api/snapshot.js` caches the public tournament snapshot for 15 seconds. Configure these Cloudflare Pages environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

The browser falls back to direct Supabase reads if the edge endpoint is unavailable.

## Why this saves Supabase egress

Previously, every Realtime score event could trigger a full re-download of tournament, teams, matches and standings. The optimized build downloads an initial compact snapshot once and then applies only the small Realtime row payload for later score changes.
