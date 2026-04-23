const nodemailer = require('nodemailer');
const axios = require('axios');

const cleanEnv = (value) => (typeof value === 'string' ? value.trim() : value);
const emailPort = Number(cleanEnv(process.env.EMAIL_PORT)) || 587;
const isSecureSmtp = process.env.EMAIL_SECURE
  ? cleanEnv(process.env.EMAIL_SECURE) === 'true'
  : emailPort === 465;
const emailFrom = cleanEnv(process.env.EMAIL_FROM) || cleanEnv(process.env.EMAIL_USER);
const smtpUser = cleanEnv(process.env.EMAIL_USER) || 'apikey';
const smtpPass = cleanEnv(process.env.EMAIL_PASS) || cleanEnv(process.env.SENDGRID_API_KEY);
const sendgridApiKey = cleanEnv(process.env.SENDGRID_API_KEY) || smtpPass;
const useSendgridHttp = Boolean(sendgridApiKey);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure: isSecureSmtp,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  tls: process.env.NODE_ENV === 'production'
    ? undefined
    : { rejectUnauthorized: false }
});

function parseFromHeader(fromValue) {
  const fromString = String(fromValue || '').trim();
  const parsed = fromString.match(/^(.*)<(.+)>$/);

  if (!parsed) {
    return { email: fromString };
  }

  return {
    name: parsed[1].trim().replace(/^"|"$/g, ''),
    email: parsed[2].trim()
  };
}

async function sendEmail({ to, subject, text, html, from = emailFrom }) {
  if (!to || !from) {
    throw new Error(`Missing required email fields: to=${to}, from=${from}`);
  }

  if (useSendgridHttp) {
    const recipients = Array.isArray(to) ? to : [to];

    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: recipients.filter(Boolean).map((email) => ({ email })) }],
        from: parseFromHeader(from),
        subject,
        content: [
          ...(text ? [{ type: 'text/plain', value: text }] : []),
          ...(html ? [{ type: 'text/html', value: html }] : [])
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return true;
  }

  await transporter.sendMail({ from, to, subject, text, html });
  return true;
}

module.exports = {
  emailFrom,
  sendEmail
};
