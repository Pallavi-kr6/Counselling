const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getNotifications(userId, options = {}) {
  const {
    includeRead = false,
    limit = 50,
    offset = 0,
    actionRequiredOnly = false
  } = options;

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeRead) {
    query = query.eq('is_read', false);
  }

  if (actionRequiredOnly) {
    query = query.eq('action_required', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get notifications error:', error);
    throw new Error('Failed to load notifications');
  }

  return data || [];
}

async function getActionNotifications(userId) {
  return getNotifications(userId, { actionRequiredOnly: true, includeRead: false });
}

async function markAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      action_required: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Mark notification as read error:', error);
    throw new Error('Failed to mark notification as read');
  }

  return true;
}

async function markAllAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      action_required: false,
      updated_at: new Date().toISOString()
    })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Mark all notifications as read error:', error);
    throw new Error('Failed to mark all notifications as read');
  }

  return true;
}

async function deleteNotification(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Delete notification error:', error);
    throw new Error('Failed to delete notification');
  }

  return true;
}

async function cleanupExpiredNotifications() {
  const { error, count } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Cleanup expired notifications error:', error);
    throw new Error('Failed to clean up expired notifications');
  }

  return count || 0;
}

async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Get unread count error:', error);
    throw new Error('Failed to get unread count');
  }

  return count || 0;
}

async function getActionRequiredCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('action_required', true)
    .eq('is_read', false);

  if (error) {
    console.error('Get action required count error:', error);
    throw new Error('Failed to get action-required count');
  }

  return count || 0;
}

module.exports = {
  getNotifications,
  getActionNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupExpiredNotifications,
  getUnreadCount,
  getActionRequiredCount
};
