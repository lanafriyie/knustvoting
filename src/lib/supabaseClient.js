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

const isPlaceholderConfig =
  !SUPABASE_URL ||
  SUPABASE_URL.includes('your-project-ref') ||
  SUPABASE_URL.includes('placeholder') ||
  !SUPABASE_KEY ||
  SUPABASE_KEY.includes('your-publishable-key') ||
  SUPABASE_KEY.includes('placeholder');

let supabase;

if (isPlaceholderConfig) {
  // Create an offline mock stub that resolves immediately with empty/safe data
  // so no dead network requests trigger ERR_INTERNET_DISCONNECTED in dev console.
  const createQueryChain = () => {
    const chain = {
      select: () => chain,
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
      catch: (reject) => Promise.resolve({ data: [], error: null }).catch(reject),
    };
    return chain;
  };

  supabase = {
    from: () => createQueryChain(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
    channel: () => ({
      on: () => ({
        subscribe: (cb) => {
          if (typeof cb === 'function') setTimeout(() => cb('SUBSCRIBED'), 0);
          return { unsubscribe: () => {} };
        }
      }),
      subscribe: (cb) => {
        if (typeof cb === 'function') setTimeout(() => cb('SUBSCRIBED'), 0);
        return { unsubscribe: () => {} };
      },
    }),
    removeChannel: () => {},
  };
} else {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.warn('[SecureVote] Initializing fallback client:', err);
    supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null })
      }),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      channel: () => ({ on: () => ({ subscribe: () => {} }) }),
      removeChannel: () => {},
    };
  }
}

export { supabase };
