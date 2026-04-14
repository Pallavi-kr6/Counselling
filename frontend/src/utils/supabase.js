import { createClient } from '@supabase/supabase-js';

// Fallback to a mock URL if env is not configured yet, preventing app crashes
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);