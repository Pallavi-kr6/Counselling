const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getCounsellorAvailabilityKeys(profile) {
  if (!profile) return [];
  return [...new Set([profile.id, profile.user_id].filter(Boolean))];
}

// Get student profile
router.get('/student/:id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', req.params.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ profile: data || null });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/Update student profile
router.post('/student', verifyToken, async (req, res) => {
  try {
    const { name, year, course, gender, contactInfo, department } = req.body;

    const profileData = {
      user_id: req.user.userId,
      name: name || null,
      year: year || null,
      course: course || null,
      gender: gender || null,
      contact_info: contactInfo || null,
      department: department || null
    };

    // Check if profile exists
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', req.user.userId)
      .single();

    let result;
    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('student_profiles')
        .update(profileData)
        .eq('user_id', req.user.userId)
        .select()
        .single();
 if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}
      result = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('student_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
      }
      result = data;
    }

    res.json({ profile: result });
  } catch (error) {
    console.error('Create/update student profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get counsellor profile
router.get('/counsellor/:id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('counsellor_profiles')
      .select('*')
      .eq('user_id', req.params.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ profile: data || null });
  } catch (error) {
    console.error('Get counsellor profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/Update counsellor profile
router.post('/counsellor', verifyToken, async (req, res) => {
  try {
    const { name, designation, teacherId, gmail, roomNo, phoneNo, department } = req.body;

    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can create counsellor profiles' });
    }

    const profileData = {
      user_id: req.user.userId,
      name: name || null,
      designation: designation || null,
      teacher_id: teacherId || null,
      gmail: gmail || null,
      room_no: roomNo || null,
      phone_no: phoneNo || null,
      department: department || null
    };

    // Check if profile exists
    const { data: existing } = await supabase
      .from('counsellor_profiles')
      .select('id')
      .eq('user_id', req.user.userId)
      .single();

    let result;
    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('counsellor_profiles')
        .update(profileData)
        .eq('user_id', req.user.userId)
        .select()
        .single();

      if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}
      result = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('counsellor_profiles')
        .insert(profileData)
        .select()
        .single();

       if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}
      result = data;
    }

    res.json({ profile: result });
  } catch (error) {
    console.error('Create/update counsellor profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all counsellors (for students to browse)
router.get('/counsellors', verifyToken, async (req, res) => {
  try {
    // Get student's department
    const { data: studentProfile, error: studentError } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', req.user.userId)
      .single();

    if (studentError && studentError.code !== 'PGRST116') {
      throw studentError;
    }

    const studentDepartment = studentProfile?.department;
    console.log('=== COUNSELLOR FETCH ===');
    console.log('Student ID:', req.user.userId);
    console.log('Student Profile:', studentProfile);
    console.log('Student Department:', studentDepartment);

    // Get ALL counsellors first (for debugging)
    const { data: allCounsellors, error: allError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id, name, designation, department, room_no, phone_no')
      .order('name');

    if (allError) throw allError;

    console.log('All counsellors in DB:', allCounsellors?.map(c => ({ name: c.name, dept: c.department })));

    // Filter by department if student has one
    let filteredCounsellors = allCounsellors || [];
    if (req.user.userType === 'student' && studentDepartment) {
      console.log('Filtering by department (case-insensitive):', studentDepartment);
      filteredCounsellors = (allCounsellors || []).filter(c => 
        c.department && c.department.trim().toLowerCase() === studentDepartment.trim().toLowerCase()
      );
      console.log('Filtered counsellors:', filteredCounsellors?.map(c => ({ name: c.name, dept: c.department })));
    }

    // Get availability for each counsellor. Some databases store
    // counsellor_availability.counsellor_id as profile.id, others as user_id.
    const counsellorsWithAvailability = await Promise.all(
      filteredCounsellors.map(async (counsellor) => {
        const { data: availability } = await supabase
          .from('counsellor_availability')
          .select('*')
          .in('counsellor_id', getCounsellorAvailabilityKeys(counsellor));

        // Counsellor is available only if they have at least one availability slot marked as available
        // If no availability records exist or all are marked as unavailable, counsellor is unavailable
        const isAvailable = availability && availability.length > 0 
          ? availability.some(slot => slot.is_available === true) 
          : false;
        
        return { ...counsellor, isAvailable };
      })
    );

    console.log('Returning', counsellorsWithAvailability.length, 'counsellors');
    res.json({ counsellors: counsellorsWithAvailability });
  } catch (error) {
    console.error('Get counsellors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get counsellor availability
router.get('/counsellor/availability/:userId', verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Resolve the public user id to the profile row, then accept either
    // profile.id or user_id in availability rows.
    const { data: profile, error: profileError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    if (!profile) {
      return res.json({ availability: [] });
    }

    const { data, error } = await supabase
      .from('counsellor_availability')
      .select('*')
      .in('counsellor_id', getCounsellorAvailabilityKeys(profile))
      .order('day_order_id');

  if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ availability: data || [] });
  } catch (error) {
    console.error('Get counsellor availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle counsellor availability
router.put('/counsellor/availability/:userId/toggle', verifyToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { isAvailable } = req.body;

    // Resolve the user id to the profile row, then update both supported
    // counsellor identifier styles in availability rows.
    const { data: profile, error: profileError } = await supabase
      .from('counsellor_profiles')
      .select('id, user_id')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    if (!profile) {
      return res.status(404).json({ error: 'Counsellor profile not found' });
    }

    const { data, error } = await supabase
      .from('counsellor_availability')
      .update({ is_available: isAvailable })
      .in('counsellor_id', getCounsellorAvailabilityKeys(profile))
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ availability: data || [] });
  } catch (error) {
    console.error('Toggle counsellor availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
