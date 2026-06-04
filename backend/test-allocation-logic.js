const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { sendChatSummaryToCounsellor } = require('./services/summaryService');
const { handleCrisisIfDetected } = require('./services/crisisService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTest() {
  console.log('🧪 Starting Student-Counsellor Privacy & Summary Integration Tests...');
  
  // 1. Fetch some counsellor user ids
  const { data: counsellors, error: cpErr } = await supabase
    .from('counsellor_profiles')
    .select('id, user_id, name')
    .limit(2);
    
  if (cpErr || !counsellors || counsellors.length === 0) {
    console.error('❌ Could not fetch counsellors to run verification:', cpErr);
    return;
  }
  
  console.log(`Available counsellors in database: ${counsellors.map(c => `${c.name} (User ID: ${c.user_id}, Profile ID: ${c.id})`).join(', ')}`);
  
  // 2. Fetch a student profile
  const { data: students, error: spErr } = await supabase
    .from('student_profiles')
    .select('user_id, name, assigned_counsellor_id')
    .limit(1);
    
  if (spErr || !students || students.length === 0) {
    console.error('❌ Could not fetch students to run verification:', spErr);
    return;
  }
  
  const testStudent = students[0];
  console.log(`Testing with student: ${testStudent.name} (${testStudent.user_id})`);
  const initialCounsellorId = testStudent.assigned_counsellor_id;
  console.log(`Current assigned counsellor ID on profile: ${initialCounsellorId}`);

  // Test 3. Auto-Allocation Mock Triggering
  const primaryCounsellor = counsellors[0];
  console.log(`Mock-assigning counsellor ${primaryCounsellor.name} (${primaryCounsellor.user_id}) to student ${testStudent.name}...`);
  
  const { error: assignError } = await supabase
    .from('student_profiles')
    .update({ assigned_counsellor_id: primaryCounsellor.user_id })
    .eq('user_id', testStudent.user_id);
    
  if (assignError) {
    console.error('❌ Failed mock-assigning counsellor:', assignError.message);
    return;
  }
  console.log('✅ Counsellor assigned successfully!');

  // Test 4. Verify AI chat summary service (mock run)
  console.log('\n--- Test 4: AI Summary generation ---');
  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY is missing. Skipping AI summarization API call.');
  } else {
    // Check if session exists for student, if not create a mock session to test summarization
    let { data: session } = await supabase
      .from('sessions')
      .select('id, messages')
      .eq('user_id', testStudent.user_id)
      .limit(1)
      .maybeSingle();
      
    if (!session) {
      console.log('No active session found. Creating a mock session...');
      const { data: newSession, error: createSessionErr } = await supabase
        .from('sessions')
        .insert({
          user_id: testStudent.user_id,
          messages: [
            { role: 'user', content: 'Hello, I feel a bit anxious about my upcoming exams and need someone to talk to.', timestamp: new Date().toISOString() },
            { role: 'assistant', content: 'I understand. Exam anxiety is very common. Let\'s explore some strategies to manage it.', timestamp: new Date().toISOString() }
          ]
        })
        .select()
        .single();
        
      if (createSessionErr) {
        console.error('❌ Failed creating mock session:', createSessionErr.message);
      } else {
        session = newSession;
        console.log(`Created mock session ${session.id}`);
      }
    }

    if (session) {
      console.log(`Using session ${session.id} with ${session.messages?.length || 0} messages.`);
      console.log('Attempting to invoke summaryService...');
      await sendChatSummaryToCounsellor(testStudent.user_id, session.id);
      console.log('AI Summarization call completed.');
    }
  }

  // Test 5. Verify direct crisis routing
  console.log('\n--- Test 5: Crisis Direct Routing ---');
  const { detected, matched, alertId } = await handleCrisisIfDetected({
    message: 'I feel completely worthless and hopeless, want to end my life',
    studentId: testStudent.user_id,
    studentEmail: 'student.test@college.edu',
    sessionId: null
  });
  console.log(`Crisis detection outcome: detected=${detected}, keywords matched: ${matched}, alertId: ${alertId}`);
  
  if (alertId) {
    // Fetch the inserted alert to verify it routed to the right counsellor
    const { data: alert } = await supabase
      .from('crisis_alerts')
      .select('assigned_counsellor_id, assigned_counsellor_name')
      .eq('id', alertId)
      .single();
      
    console.log(`Alert record verification: assigned_counsellor_id=${alert?.assigned_counsellor_id}, name=${alert?.assigned_counsellor_name}`);
    if (alert?.assigned_counsellor_id === primaryCounsellor.id) {
      console.log('✅ Success! Crisis alert was routed directly to the student\'s assigned counsellor (counsellor_profiles.id).');
    } else {
      console.error(`❌ Failed! Alert was not routed to the assigned counsellor. Expected profile ID ${primaryCounsellor.id}, but got ${alert?.assigned_counsellor_id}`);
    }
  }

  // Reset assignment to initial state to keep DB clean
  console.log('\nResetting mock database state...');
  await supabase
    .from('student_profiles')
    .update({ assigned_counsellor_id: initialCounsellorId })
    .eq('user_id', testStudent.user_id);
  console.log('✅ Finished.');
}

runTest().catch(console.error);
