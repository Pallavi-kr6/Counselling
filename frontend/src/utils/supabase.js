import { createClient } from '@supabase/supabase-js';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to frontend/.env and restart the React dev server.`);
  }
  return value;
};

const supabaseUrl = requireEnv('REACT_APP_SUPABASE_URL');
const supabaseAnonKey = requireEnv('REACT_APP_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
