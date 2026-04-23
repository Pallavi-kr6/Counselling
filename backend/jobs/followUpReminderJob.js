const { processDueFollowUps } = require('../services/followUpService');

let isRunning = false;

async function runFollowUpReminderJob() {
  if (isRunning) {
    console.log('[follow-up] Previous reminder job is still running, skipping overlap.');
    return 0;
  }

  isRunning = true;

  try {
    const processedCount = await processDueFollowUps();
    console.log(`[follow-up] Reminder job finished. Processed ${processedCount} appointment(s).`);
    return processedCount;
  } catch (error) {
    console.error('[follow-up] Reminder job failed:', error.message);
    return 0;
  } finally {
    isRunning = false;
  }
}

module.exports = {
  runFollowUpReminderJob
};
