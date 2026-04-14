const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');

// Supabase client for database operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Supabase client for auth (uses anon key for client-side auth)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

// Email transporter with connection verification
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure: isSecureSmtp,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  // Keep local self-signed certs usable while enforcing strict TLS in production.
  tls: process.env.NODE_ENV === 'production'
    ? undefined
    : { rejectUnauthorized: false }
});

if (!useSendgridHttp) {
  // Verify transporter connection on startup only for SMTP mode.
  transporter.verify(function (error, success) {
    if (error) {
      console.error('❌ Email transporter verification failed:', error);
      console.error('Email config:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: smtpUser ? 'Set' : 'Missing',
        pass: smtpPass ? 'Set' : 'Missing'
      });
    } else {
      console.log('✅ Email transporter is ready to send emails');
    }
  });
}

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

async function sendEmail(mailOptions) {
  if (useSendgridHttp) {
    const from = parseFromHeader(mailOptions.from || emailFrom);
    const to = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: to.filter(Boolean).map((email) => ({ email })) }],
        from,
        subject: mailOptions.subject,
        content: [
          ...(mailOptions.text ? [{ type: 'text/plain', value: mailOptions.text }] : []),
          ...(mailOptions.html ? [{ type: 'text/html', value: mailOptions.html }] : [])
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
    return { via: 'sendgrid-http' };
  }

  return transporter.sendMail(mailOptions);
}

// Store OTPs temporarily
const otpStore = new Map();
// Store signup data temporarily (email -> profile data)
const signupDataStore = new Map();
// Store password reset tokens (token -> { userId, expiresAt })
const passwordResetStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(24).toString('hex');
}

// Send OTP (for login)
router.post('/student/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check environment variables
    if (!process.env.EMAIL_HOST || !smtpUser || !smtpPass) {
      console.error('❌ Email configuration missing!');
      return res.status(500).json({ 
        error: 'Email service not configured. Please contact administrator.' 
      });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(email.toLowerCase(), { otp, expiresAt });

    console.log(`📧 Sending OTP to ${email}...`);
    console.log(`🔑 OTP Code: ${otp} (for testing - remove in production)`);

    // Send email
    const mailOptions = {
      from: `"College Counselling App" <${emailFrom}>`,
      to: email,
      subject: 'Your Login OTP Code - College Counselling App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">College Counselling App</h2>
          <p>Your OTP code for login is:</p>
          <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your OTP code is: ${otp}. This code will expire in 10 minutes.`
    };

    const info = await sendEmail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    console.log('📬 Email response:', info.response);

    res.json({ 
      success: true, 
      message: 'OTP code sent to your email. Please check your inbox (and spam folder).' 
    });
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    
    // More specific error messages
    let errorMessage = 'Failed to send OTP. Please try again.';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Please check your internet connection.';
    } else if (error.response) {
      errorMessage = `Email server error: ${error.response}`;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Send OTP for signup (stores profile data temporarily)
router.post('/student/send-signup-otp', async (req, res) => {
  try {
    const { email, password, name, year, course, gender, contactInfo, department } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = usersList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists. Please login instead.' });
    }

    // Check environment variables
    if (!process.env.EMAIL_HOST || !smtpUser || !smtpPass) {
      console.error('❌ Email configuration missing!');
      return res.status(500).json({ 
        error: 'Email service not configured. Please contact administrator.' 
      });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const emailKey = email.toLowerCase();
    
    // Store OTP
    otpStore.set(emailKey, { otp, expiresAt });
    
    // Store signup data temporarily (including password)
    signupDataStore.set(emailKey, {
      email,
      password,
      name,
      year,
      course,
      gender,
      contactInfo,
      department,
      expiresAt
    });

    console.log(`📧 Sending signup OTP to ${email}...`);
    console.log(`🔑 OTP Code: ${otp} (for testing - remove in production)`);

    // Send email
    const mailOptions = {
      from: `"College Counselling App" <${emailFrom}>`,
      to: email,
      subject: 'Verify Your Email - College Counselling App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">College Counselling App</h2>
          <p>Your OTP code to verify your email and complete signup is:</p>
          <div style="background-color: #f5f7fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your OTP code is: ${otp}. This code will expire in 10 minutes.`
    };

    const info = await sendEmail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);

    res.json({ 
      success: true, 
      message: 'OTP code sent to your email. Please check your inbox (and spam folder).' 
    });
  } catch (error) {
    console.error('❌ Send signup OTP error:', error);
    
    let errorMessage = 'Failed to send OTP. Please try again.';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Please check your internet connection.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Verify OTP and create/login user
router.post('/student/verify-otp', async (req, res) => {
  try {
    const { email, otp, isSignup } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const emailKey = email.toLowerCase();
    const storedData = otpStore.get(emailKey);

    if (!storedData) {
      return res.status(400).json({ error: 'OTP not found. Please request a new OTP.' });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(emailKey);
      signupDataStore.delete(emailKey);
      return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP code. Please try again.' });
    }

    // OTP verified - remove from store
    otpStore.delete(emailKey);

    // Check if this is a signup (has stored profile data)
    const signupData = signupDataStore.get(emailKey);
    const isNewSignup = isSignup && signupData;

    // Check if user exists
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    let user = usersList?.users?.find(u => u.email?.toLowerCase() === emailKey);

    if (!user) {
      // Create new user with password if signup
      const userData = {
        email: email,
        email_confirm: true,
        user_metadata: {
          user_type: 'student'
        }
      };

      // Add password if this is a signup
      if (isNewSignup && signupData && signupData.password) {
        userData.password = signupData.password;
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(userData);

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      user = authData.user;

      // Create user record
      await supabaseAdmin.from('users').insert({
        id: user.id,
        email: email,
        user_type: 'student'
      });

      // If signup, create profile
      if (isNewSignup && signupData) {
        const { error: profileError } = await supabaseAdmin
          .from('student_profiles')
          .insert({
            user_id: user.id,
            name: signupData.name || null,
            year: signupData.year || null,
            course: signupData.course || null,
            gender: signupData.gender || null,
            contact_info: signupData.contactInfo || null,
            department: signupData.department || null
          });

        if (profileError) {
          console.error('Student profile insert error:', profileError);
        }

        // Remove signup data from store
        signupDataStore.delete(emailKey);
      }
    } else {
      // Ensure user exists in users table
      await supabaseAdmin.from('users').upsert({
        id: user.id,
        email: email,
        user_type: 'student'
      });
    }

    // Generate access token using JWT (simpler approach)
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        userType: 'student'
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
});

// Student Signup with Supabase Auth
router.post('/student/signup', async (req, res) => {
  try {
    const { email, password, name, year, course, gender, contactInfo, department } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Create user in Supabase Auth using admin (no email confirmation needed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        user_type: 'student'
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    console.log('Auth user created:', authData.user.id, authData.user.email);

    // Create user record in users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        user_type: 'student'
      })
      .select()
      .single();

    console.log('Signup insert result:', userData, userError);

    if (userError) {
      // If user creation fails, try to get existing user
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      console.log('Existing user check:', existingUser);

      if (!existingUser) {
        throw userError;
      }
    }

    // Create student profile (always create, even with null values)
    const { error: profileError } = await supabaseAdmin
      .from('student_profiles')
      .insert({
        user_id: authData.user.id,
        name: name || null,
        year: year || null,
        course: course || null,
        gender: gender || null,
        contact_info: contactInfo || null,
        department: department || null
      });

    if (profileError) {
      console.error('Student profile insert error:', profileError);
      // Don't fail the signup if profile fails
    }

    // Since we auto-confirm, return user data directly
    res.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        userType: 'student'
      }
    });
  } catch (error) {
    console.error('Student signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student Login with Supabase Auth
router.post('/student/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        userType: 'student'
      },
      session: data.session
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset (send email with tokenized link)
router.post('/student/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Find user via admin list
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const user = usersList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Create token and store with 1 hour expiry
    const token = generateToken();
    const expiresAt = Date.now() + 60 * 60 * 1000;
    passwordResetStore.set(token, { userId: user.id, expiresAt });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Send email
    const mailOptions = {
      from: `"College Counselling App" <${emailFrom}>`,
      to: email,
      subject: 'Password reset request',
      html: `
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the link below to reset it. This link expires in 1 hour.</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you did not request this, please ignore this email.</p>
      `,
      text: `Reset your password: ${resetLink}`
    };

    await sendEmail(mailOptions);

    res.json({ success: true, message: 'Password reset link sent to email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

// Reset password using token
router.post('/student/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });

    const record = passwordResetStore.get(token);
    if (!record) return res.status(400).json({ error: 'Invalid or expired token' });

    if (Date.now() > record.expiresAt) {
      passwordResetStore.delete(token);
      return res.status(400).json({ error: 'Token expired' });
    }

    const userId = record.userId;

    // Attempt to update user password via Supabase Admin API
    try {
      const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    } catch (err) {
      console.error('Error updating password via admin API:', err);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    // Remove token
    passwordResetStore.delete(token);

    res.json({ success: true, message: 'Password has been reset' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Counsellor Login (Direct access with teacher_id)
router.post('/counsellor/login', async (req, res) => {
  try {
    const { teacherId, name } = req.body;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }

    // Find counsellor by teacher_id
    const { data: counsellorProfile, error: profileError } = await supabaseAdmin
      .from('counsellor_profiles')
      .select('*, user_id')
      .eq('teacher_id', teacherId)
      .single();

    console.log('Counsellor login - teacherId:', teacherId);
    console.log('Counsellor profile:', counsellorProfile, 'Error:', profileError);

    if (profileError || !counsellorProfile) {
      return res.status(404).json({ error: 'Counsellor not found' });
    }

    // Get user record
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', counsellorProfile.user_id)
      .single();

    console.log('User record:', user, 'Error:', userError);

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate JWT token for counsellor
    const token = jwt.sign(
      {
        userId: user.id,
        userType: 'counsellor',
        teacherId: teacherId
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // Longer session for counsellors
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        userType: 'counsellor',
        teacherId: teacherId,
        name: counsellorProfile.name
      }
    });
  } catch (error) {
    console.error('Counsellor login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Token Middleware
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  // 🔹 1. Try Counsellor JWT FIRST
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If it has userType = counsellor, accept it
    if (decoded.userType === 'counsellor') {
      req.user = decoded;
      return next();
    }
  } catch (e) {
    // Not a counsellor JWT → continue
  }

  // 🔹 2. Try Supabase token (student)
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    // 🔹 3. Try JWT token (for OTP login)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.userType === 'student') {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          userType: 'student'
        };
        return next();
      }
    } catch (jwtError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = {
    userId: data.user.id,
    email: data.user.email,
    userType: 'student'
  };

  next();
}

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const userType = req.user.userType;

    // Check userType from verifyToken middleware (this is the source of truth)
    if (userType === 'student') {
      // Student - ensure database is in sync
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, email, user_type')
        .eq('id', userId)
        .single();

      // If user doesn't exist in database, create it
      if (error && error.code === 'PGRST116') {
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: req.user.email,
            user_type: 'student',
            is_anonymous: false
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return res.json({
          user: {
            id: newUser.id,
            email: newUser.email,
            userType: 'student'
          }
        });
      }

      if (error) throw error;

      // Ensure user_type in database matches (fix any inconsistencies)
      if (user.user_type !== 'student') {
        await supabaseAdmin
          .from('users')
          .update({ user_type: 'student' })
          .eq('id', userId);
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email || req.user.email,
          userType: 'student'
        }
      });
    } else if (userType === 'counsellor') {
      // Counsellor - get from database
    const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, email, user_type')
    .eq('id', userId)
    .single();

  if (userError) throw userError;

  // Get counsellor profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('counsellor_profiles')
    .select('name, teacher_id')
    .eq('user_id', userId)
    .single();

  if (profileError) throw profileError;

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      userType: 'counsellor',
      teacherId: profile.teacher_id,
      name: profile.name   // ✅ ADD NAME HERE
    }
  });
    } else {
      // Fallback - determine from database (shouldn't happen in normal flow)
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, email, user_type')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          userType: user.user_type || 'student'
        }
      });
    }
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken;
