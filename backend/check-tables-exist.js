const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('get_tables'); // Let's see if we can query pg_tables
  if (error) {
    console.log('RPC get_tables not available, trying select from information_schema...');
    // We can't do raw select on information_schema unless we have a specific RPC or table.
    // Let's try checking individual tables one by one using a lightweight select
    const tables = ['users', 'counsellor_profiles', 'student_profiles', 'sessions', 'crisis_alerts', 'student_watch_flags', 'notifications', 'mood_logs', 'student_consents'];
    for (const table of tables) {
      const { data: tData, error: tErr } = await supabase.from(table).select('*').limit(1);
      if (tErr) {
        console.log(`❌ Table ${table} error:`, tErr.code, tErr.message);
      } else {
        console.log(`✅ Table ${table} exists! Data count:`, tData.length);
      }
    }
  } else {
    console.log('Tables:', data);
  }
}

check();
