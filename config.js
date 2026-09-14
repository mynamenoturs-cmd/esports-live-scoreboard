export const CONFIG = {
  SUPABASE_URL: 'https://vbmjdwjjrtpftdernmzk.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_U63aOjXBq5cwoV1aqrGH9Q_pEV_ChZk',
  DEFAULT_TOURNAMENT_SLUG: 'esport-championship',
  APP_NAME: 'Live Scoreboard E-Sport',
  USE_CLOUDFLARE_EDGE_CACHE: true,
  PUBLIC_SNAPSHOT_URL: '/api/snapshot',
  EDGE_SNAPSHOT_TTL_SECONDS: 15,
  SUPABASE_EGRESS_SOFT_BUDGET_MB: 250,
  SUPABASE_STORAGE_TARGET_MB: 0,
  CLOUDFLARE_R2_SOFT_BUDGET_MB: 500
};

export const isConfigured = () =>
  CONFIG.SUPABASE_URL.startsWith('https://') &&
  !CONFIG.SUPABASE_URL.includes('PASTE_') &&
  CONFIG.SUPABASE_PUBLISHABLE_KEY.length > 40 &&
  !CONFIG.SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');

if (typeof window !== 'undefined' && /^\/admin\/?$/.test(window.location.pathname)) {
  import('./marshal-admin.js?v=ca346aba').catch((err) => console.error('Marshal panel:', err));
}
