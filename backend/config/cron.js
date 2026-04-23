const notificationService = require('../services/notificationService');

/**
 * Starts background maintenance tasks for the application.
 * Uses setInterval to avoid adding node-cron as a dependency if not already present.
 */
const startCronJobs = () => {
  console.log('🚀 Starting background maintenance jobs...');
  
  // 1. Cleanup expired notifications every hour
  // This handles the automatic expiration of reassignment requests (2-min timer etc)
  setInterval(async () => {
    try {
      const count = await notificationService.cleanupExpiredNotifications();
      if (count > 0) {
        console.log(`[cron] Maintenance: Cleaned up ${count} expired notifications`);
      }
    } catch (error) {
      console.error('[cron] Maintenance error (cleanup notifications):', error);
    }
  }, 60 * 60 * 1000); // Run every 1 hour
  
  // 2. You can add more periodic tasks here
  // Example: daily reports, clearing old logs, etc.
  
  console.log('✅ Background jobs initialized');
};

module.exports = { startCronJobs };
