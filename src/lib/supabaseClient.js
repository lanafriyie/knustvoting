// supabaseClient.js
// Initialize Supabase client. Uses Vite-style import.meta.env vars.
import { createClient } from '@supabase/supabase-js';

// Vite exposes env vars via import.meta.env (not process.env)
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    '[SecureVote] Supabase credentials missing. ' +
    'Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the dev server.'
  );
}

// Guard: createClient throws if URL is empty — wrap so the app still renders
let supabase;
try {
  supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder');
} catch (err) {
  console.error('[SecureVote] Failed to initialise Supabase client:', err);
  // Return a no-op stub so imports don't crash
  supabase = {
    from: () => ({ select: () => Promise.resolve({ data: null, error: err }), insert: () => Promise.resolve({ data: null, error: err }) }),
    rpc: () => Promise.resolve({ data: null, error: err }),
    auth: { getUser: () => Promise.resolve({ data: { user: null }, error: err }) },
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
  };
}

export { supabase };
