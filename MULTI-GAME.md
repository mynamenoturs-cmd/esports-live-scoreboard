# Multi-game mode: FIFA + MLBB

The tournament has two independent game divisions:

- `fifa` — EA SPORTS FC / FIFA, goal scoring, BO1 by default, group draws allowed, knockout ties can use a tie-break / penalty score.
- `mlbb` — Mobile Legends: Bang Bang, series scoring, BO3 by default, no draw.

Each team belongs to exactly one game. Each match also belongs to exactly one game and the database prevents teams from a different game being assigned to that match.

`set_live_match()` only replaces the live match inside the same game. This means a FIFA match and an MLBB match may both be live at the same time.

Public pages support `?game=fifa` and `?game=mlbb`, for example:

- `/live.html?game=fifa`
- `/live.html?game=mlbb`
- `/bracket.html?game=fifa`
- `/overlay.html?game=mlbb`

The public Cloudflare snapshot contains both game divisions in one small JSON payload, so it remains quota-efficient for a one-day event.
