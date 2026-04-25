require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase.from('student_consents').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Table exists, data:', data);
  }
}
check();
