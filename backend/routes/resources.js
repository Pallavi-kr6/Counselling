const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Canonical category → keyword mapping used by /suggest ────
const TOPIC_KEYWORDS = {
  stress:        ['stress', 'overwhelm', 'pressure', 'burnout', 'overload'],
  anxiety:       ['anxious', 'anxiety', 'panic', 'worry', 'nervous', 'scared', 'fear', 'dread'],
  relationships: ['friend', 'family', 'relationship', 'breakup', 'lonely', 'loneliness', 'social', 'parent', 'partner', 'love'],
  academic:      ['exam', 'test', 'study', 'grade', 'assignment', 'homework', 'academic', 'marks', 'score', 'semester', 'lecture', 'class', 'focus', 'concentrate'],
};

// ─────────────────────────────────────────────────────────────
// GET /api/resources
// Returns active resources, optionally filtered by category/type.
// ─────────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, type } = req.query;

    let query = supabase
      .from('resources')
      .select('id, title, description, category, url, type, created_at')
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    // Normalise: ensure every row has a usable link field
    const normalised = (data || []).map(r => ({
      ...r,
      content_url: r.content_url || r.url || null,
    }));

    res.json({ resources: normalised });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/resources/suggest?topic=<stress|anxiety|relationships|academic>
// Returns one random active resource matching the topic.
// Called by the chatbot after each bot reply to attach a relevant card.
// IMPORTANT: define BEFORE /:id so Express doesn't treat 'suggest' as an id.
// ─────────────────────────────────────────────────────────────
router.get('/suggest', verifyToken, async (req, res) => {
  try {
    const { topic } = req.query;

    const VALID_CATEGORIES = ['stress', 'anxiety', 'relationships', 'academic'];
    if (!topic || !VALID_CATEGORIES.includes(topic)) {
      return res.json({ resource: null });
    }

    const { data, error } = await supabase
      .from('resources')
      .select('id, title, description, category, url, type')
      .eq('category', topic)
      .limit(5);   // fetch a small pool and pick randomly for variety

    if (error || !data?.length) {
      return res.json({ resource: null });
    }

    // Random pick for variety across sessions
    const pick = data[Math.floor(Math.random() * data.length)];
    res.json({
      resource: {
        ...pick,
        content_url: pick.content_url || pick.url || null,
      },
    });
  } catch (error) {
    console.error('Suggest resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/resources/:id  — fetch single resource
// ─────────────────────────────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('id, title, description, category, url, type, created_at')
      .eq('id', req.params.id)
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      data.content_url = data.url;
    }
    res.json({ resource: data });
  } catch (error) {
    console.error('Get resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/resources  — create resource (counsellors + admins)
// ─────────────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'counsellor' && req.user.userType !== 'admin') {
      console.warn('Access denied: User is not a counsellor or admin. userType:', req.user.userType);
      return res.status(403).json({ error: 'Only counsellors or admins can create resources' });
    }

    const { title, description, type, category, content_url, url, tags } = req.body;

    if (!title || !type || !category) {
      return res.status(400).json({ error: 'title, type, and category are required' });
    }

    const resolvedUrl = content_url || url || null;

    const { data, error } = await supabase
      .from('resources')
      .insert({
        title,
        description: description || null,
        type,
        category,
        url:         resolvedUrl,
        tags:        tags || [],
        created_by:  req.user.userId,
      })
      .select('id, title, description, category, url, type, created_at')
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      data.content_url = data.url;
    }
    res.json({ resource: data });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/resources/:id  — update resource (admin only)
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { title, description, type, category, url } = req.body;
    const updates = { 
      updated_at: new Date().toISOString() 
    };
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (type) updates.type = type;
    if (category) updates.category = category;
    if (url) updates.url = url;

    const { data, error } = await supabase
      .from('resources')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, title, description, category, url, type, created_at')
      .single();
    if (error) throw error;
    res.json({ resource: data });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/resources/:id/view  — track resource engagement
// ─────────────────────────────────────────────────────────────
router.post('/:id/view', verifyToken, async (req, res) => {
  try {
    const { error } = await supabase
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
    console.log('--- Delete Authorization Check ---');
    console.log('Request User:', req.user);
    if (req.user.userType !== 'counsellor') {
      console.warn('Delete Access denied: User is not a counsellor. userType:', req.user.userType);
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

// Removed duplicate suggested resource endpoint. Consolidate logic in the authenticated /suggest route if public access is needed.


module.exports = router;
