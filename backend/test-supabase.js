const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Using SUPABASE_URL:', url ? 'set' : 'missing');
  console.log('Using SUPABASE_SERVICE_ROLE_KEY:', key ? 'set' : 'missing');

  if (!url || !key) {
    console.error('Missing SUPABASE credentials in .env');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  try {
    console.log('Listing users (first 10)...');
    const { data, error } = await supabase.auth.admin.listUsers({ per_page: 10 });
    if (error) {
      console.error('Error listing users:', error);
      process.exit(2);
    }
    console.log('Users returned:', Array.isArray(data?.users) ? data.users.length : 'unknown');
    if (Array.isArray(data?.users)) {
      data.users.forEach(u => console.log('-', u.id, u.email));
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(3);
  }
}

run();
