const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all resources
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, type } = req.query;

    let query = supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ resources: data || [] });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get resource by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ resource: data });
  } catch (error) {
    console.error('Get resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create resource (counsellors only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can create resources' });
    }

    const { title, description, type, category, url, content, tags } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title and type are required' });
    }

    const { data, error } = await supabase
      .from('resources')
      .insert({
        title,
        description: description || null,
        type, // 'article', 'video', 'podcast', 'toolkit'
        category, // 'stress', 'exam-pressure', 'time-management', 'relationships', etc.
        url: url || null,
        content: content || null,
        tags: tags || [],
        created_by: req.user.userId
      })
      .select()
      .single();

    if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ resource: data });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track resource view
router.post('/:id/view', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resource_views')
      .insert({
        user_id: req.user.userId,
        resource_id: req.params.id
      });

     if (error) {
  console.error(error);
  return res.status(500).json({ error: error.message });
}

    res.json({ success: true });
  } catch (error) {
    console.error('Track resource view error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete resource (counsellors only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor') {
      return res.status(403).json({ error: 'Only counsellors can delete resources' });
    }

    // 1. Get resource to check for file URL
    const { data: resource, error: getError } = await supabase
      .from('resources')
      .select('url')
      .eq('id', req.params.id)
      .single();

    if (getError) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // 2. If it's a Supabase storage URL, try to delete the file
    if (resource.url && resource.url.includes('supabase.co/storage')) {
      try {
        const urlParts = resource.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('resources').remove([fileName]);
      } catch (storageErr) {
        console.error('Failed to delete storage file:', storageErr);
        // Continue with DB deletion even if storage fails
      }
    }

    // 3. Delete from DB
    const { error: deleteError } = await supabase
      .from('resources')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      console.error(deleteError);
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
