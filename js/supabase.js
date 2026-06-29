const { createClient } = window.supabase || {};
const db = typeof createClient === 'function'
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
