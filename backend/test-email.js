const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const nodemailer = require('nodemailer');

async function runTest() {
  const cleanEnv = (value) => (typeof value === 'string' ? value.trim() : value);
  const smtpUser = cleanEnv(process.env.EMAIL_USER) || 'apikey';
  const smtpPass = cleanEnv(process.env.EMAIL_PASS) || cleanEnv(process.env.SENDGRID_API_KEY);
  const emailFrom = cleanEnv(process.env.EMAIL_FROM) || smtpUser;
  const testRecipient = cleanEnv(process.env.EMAIL_TEST_TO) || emailFrom;

  console.log('Using email config:', {
    host: process.env.EMAIL_HOST,
    port: cleanEnv(process.env.EMAIL_PORT),
    user: smtpUser ? 'Set' : 'Missing',
    pass: smtpPass ? 'Set' : 'Missing',
    from: emailFrom
  });

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(cleanEnv(process.env.EMAIL_PORT)) || 587,
    secure: Number(cleanEnv(process.env.EMAIL_PORT)) === 465, // true for 465
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false
    },
    logger: true,
    debug: true
  });

  try {
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('Transporter verified ✅');
  } catch (err) {
    console.error('Verification failed:', err);
  }

  try {
    console.log('Sending test message to self...');
    const info = await transporter.sendMail({
      from: `Test <${emailFrom}>`,
      to: testRecipient,
      subject: 'Test email from counselling app',
      text: 'This is a test email.'
    });
    console.log('Send result:', info);
  } catch (err) {
    console.error('Send failed:', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response
    });
  }
}

runTest().catch(e => console.error('Fatal error:', e));
