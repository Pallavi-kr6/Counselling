require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
  try {
    console.log('Checking counsellors...');
    const { data: counsellors, error: counsellorError } = await supabase
      .from('counsellor_profiles')
      .select('*');

    if (counsellorError) throw counsellorError;
    console.log('Counsellors:', counsellors);

    console.log('\nChecking appointments...');
    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('*');

    if (appointmentError) throw appointmentError;
    console.log('Appointments:', appointments);

    console.log('\nChecking users...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*');

    if (userError) throw userError;
    console.log('Users:', users);

    console.log('\nChecking student profiles...');
    const { data: studentProfiles, error: studentProfileError } = await supabase
      .from('student_profiles')
      .select('*');

    if (studentProfileError) throw studentProfileError;
    console.log('Student Profiles:', studentProfiles);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabase();
