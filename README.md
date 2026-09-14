# Live Scoreboard E-Sport

Sistem pertandingan e-sport futuristik untuk **Cloudflare Pages + Supabase Realtime**.

## Fungsi siap

- Dashboard awam: live score, standings, jadual, senarai team.
- `live.html`: paparan fullscreen untuk projector/TV/LED.
- `admin.html`: login admin/marshal, tambah team, tambah jadual, kawal skor, Start Live, Pause, Finish, Reset.
- `bracket.html`: bracket knockout Quarter/Semi/Final.
- `overlay.html`: overlay ringkas untuk OBS Browser Source.
- Supabase Auth + RLS.
- Supabase Realtime untuk perubahan `matches` dan `teams`.
- Standings automatik berdasarkan group matches yang `finished` (3 mata bagi kemenangan).
- Audit log untuk `set_live_match` dan `finish_match`.
- Demo Mode jika Supabase belum dikonfigurasi.

## 1. Cipta Supabase project

Guna project baru untuk scoreboard supaya tidak mengganggu database projek lain.

Dalam **SQL Editor**:

1. Run `supabase/schema.sql`.
2. Run `supabase/seed.sql` jika mahu data contoh.

## 2. Cipta admin

Dalam Supabase **Authentication > Users**, cipta user menggunakan email/password.
Selepas user wujud, jalankan SQL berikut dan tukar email:

```sql
update public.profiles p
set role='admin'
from auth.users u
where p.user_id=u.id and u.email='admin@example.com';
```

Untuk marshal, guna `role='marshal'`.

## 3. Sambungkan frontend

Buka `config.js` dan isi:

```js
export const CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_KEY',
  DEFAULT_TOURNAMENT_SLUG: 'esport-championship',
  APP_NAME: 'Live Scoreboard E-Sport'
};
```

**Jangan letakkan `service_role` atau secret key dalam frontend.** Gunakan publishable key (atau legacy anon key jika project lama).

## 4. Test secara local

Kerana projek menggunakan ES Modules, buka melalui web server, bukan `file://`.

```bash
python -m http.server 8080
```

Kemudian buka `http://localhost:8080`.

## 5. Deploy ke Cloudflare Pages

Cara paling mudah:

- Push folder ini ke GitHub.
- Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git.
- Framework preset: `None`.
- Build command: `exit 0` (sesuai untuk static site tanpa build step).
- Build output directory: `/` jika repo ini hanya mengandungi scoreboard; atau folder ini jika ia subfolder.
- Production branch: `main`.

Selepas deploy:

- `/` — dashboard awam.
- `/admin.html` — control room.
- `/live.html` — fullscreen broadcast.
- `/bracket.html` — bracket.
- `/overlay.html` — OBS Browser Source.

## Aliran pertandingan

1. Admin masukkan semua team.
2. Admin masukkan jadual perlawanan.
3. Pilih `Kawal` pada perlawanan.
4. Tekan `START LIVE`.
5. Referee/admin tekan `+` / `−` pada skor.
6. Semua skrin yang membuka dashboard/live/overlay menerima update secara Realtime.
7. Tekan `Tamat Perlawanan`; winner disimpan dan standings group dikira semula automatik.

## Struktur utama

```text
index.html      public tournament dashboard
admin.html      admin/referee control room
live.html       projector/fullscreen live display
bracket.html    knockout bracket
overlay.html    OBS browser overlay
config.js       Supabase public configuration
supabase/
  schema.sql    tables, RLS, Realtime, RPC
  seed.sql      demo tournament data
```

## Nota keselamatan

- Public (`anon`) hanya mempunyai SELECT pada data pertandingan.
- Hanya `admin` / `marshal` yang boleh INSERT/UPDATE/DELETE.
- `service_role` tidak pernah digunakan dalam browser.
- Untuk produksi, gunakan password admin yang kuat dan jangan kongsi akaun referee.

## Quota-safe architecture

This build intentionally keeps Supabase lightweight. Supabase Storage is unused; Cloudflare serves application assets, while Supabase is limited to small database rows, Auth and Realtime deltas. Public initial reads can be served through the Cloudflare Pages Function in `functions/api/snapshot.js`, which caches snapshots at the edge. See `QUOTA-GUARD.md`.
