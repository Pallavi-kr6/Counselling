const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLookup() {
  const { data: counsellors, error } = await supabase
    .from('counsellor_profiles')
    .select('id, name, user_id, users!inner(email)')
    .eq('is_available', true);

  if (error) {
    console.error('Error fetching available counsellors:', error);
  } else {
    console.log('Available counsellors:', counsellors);
  }

  // Let's also check if there are any available counsellors
  const { data: allCP, error: cpErr } = await supabase
    .from('counsellor_profiles')
    .select('id, name, is_available');
  if (cpErr) console.error('All CP error:', cpErr);
  else console.log('All CP is_available status:', allCP);
}

testLookup();
