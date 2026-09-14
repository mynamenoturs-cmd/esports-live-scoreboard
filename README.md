# Live Scoreboard E-Sport

Sistem pertandingan e-sport futuristik **FIFA + MLBB** untuk **Cloudflare Workers + Static Assets + Supabase Realtime**.

## Status projek ini

- Repo production: `main`
- Supabase production sudah disediakan dan `config.js` sudah menggunakan publishable key projek scoreboard.
- Akaun admin pertama sudah diwujudkan dan diberi role `admin`.
- Supabase Storage tidak digunakan.
- Public static assets dilayan oleh Cloudflare Static Assets.
- Worker hanya diperlukan untuk `/api/*`, manakala HTML/CSS/JS kekal static.
- Friendly route menggunakan `html_handling` Cloudflare; `_redirects` lama telah dibuang untuk mengelakkan redirect loop.

## Fungsi siap

- Dashboard awam: live score, standings, jadual dan senarai team.
- Multi-game: FIFA / EA SPORTS FC dan Mobile Legends: Bang Bang.
- FIFA: goal scoring, draw untuk group/friendly, tie-break/penalti untuk knockout.
- MLBB: BO1 / BO3 / BO5 / BO7, tanpa keputusan seri.
- FIFA dan MLBB boleh mempunyai live match berasingan pada masa yang sama.
- `/live`: paparan fullscreen projector/TV/LED.
- `/admin`: login admin/marshal, tambah pasukan, roster, jadual dan kawal skor.
- `/bracket`: knockout bracket.
- `/overlay`: OBS Browser Source.
- Supabase Auth + RLS + Realtime.
- Audit log untuk tindakan penting.
- Cloudflare edge snapshot cache di Worker `/api/snapshot`.

## Cloudflare deployment

- Production branch: `main`
- Build command: kosong
- Deploy command: `npx wrangler deploy`
- Root directory: repository root (`/`)
- Runtime variables:

```text
SUPABASE_URL=https://vbmjdwjjrtpftdernmzk.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key projek scoreboard>
```

Publishable key memang direka untuk digunakan pada client/public app. Jangan sekali-kali masukkan `service_role` atau secret key ke frontend atau GitHub.

Selepas deploy:

- `/` — dashboard awam
- `/admin` — control room
- `/live?game=fifa` — FIFA live screen
- `/live?game=mlbb` — MLBB live screen
- `/bracket?game=fifa` / `/bracket?game=mlbb` — bracket
- `/overlay?game=fifa` / `/overlay?game=mlbb` — OBS overlay

## Aliran pertandingan

1. Admin login ke `/admin`.
2. Pilih FIFA atau MLBB.
3. Masukkan peserta/pasukan dan roster.
4. Masukkan jadual perlawanan.
5. Pilih `Kawal` dan tekan `START LIVE`.
6. Perubahan skor dihantar melalui Supabase Realtime kepada live screen dan overlay.
7. Tamatkan match untuk merekod winner dan mengemas kini standings.

## Quota guard

Reka bentuk ini sengaja mengehadkan penggunaan Supabase:

- Supabase Storage target: `0 MB`.
- Supabase hanya menyimpan row kecil untuk tournament/team/player/match/Auth.
- Realtime menghantar delta row dan tidak memuat turun semula semua data setiap perubahan skor.
- HTML/CSS/JS dan visual statik dilayan oleh Cloudflare Static Assets.
- `/api/snapshot` mempunyai edge cache supaya public initial reads tidak sentiasa pergi terus ke Supabase.
- Lihat `QUOTA-GUARD.md` untuk soft budget dalaman.

## Fail utama

```text
index.html                   public dashboard
admin.html / admin.js        control room
live.html / live.js          projector/fullscreen
bracket.html / bracket.js    knockout bracket
overlay.html / overlay.js    OBS overlay
data.js                      data + Realtime + cache layer
ui.js                        shared render components
config.js                    public Supabase configuration
worker.js                    Cloudflare Worker untuk /api/*
wrangler.jsonc               Worker + Static Assets configuration
_headers                     security/cache headers
```

## Nota keselamatan

Public users hanya membaca data pertandingan. Insert/update/delete dikawal oleh Supabase RLS dan hanya role `admin` / `marshal` yang dibenarkan. `service_role` tidak digunakan dalam browser.
