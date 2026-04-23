/**
 * Follow-up Service
 * Manages the scheduling and tracking of post-session follow-ups.
 */

/**
 * Builds the schedule fields for a completed appointment.
 * Sets the completion time and a follow-up date (typically 7 days later).
 * 
 * @returns {Object} An object containing the follow-up fields for the database.
 */
const buildFollowUpSchedule = () => {
  const now = new Date();
  // Schedule the follow-up for 7 days from now
  const followupAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return {
    completed_at: now.toISOString(),
    followup_at: followupAt.toISOString(),
    student_followup_sent_at: null,
    counsellor_followup_sent_at: null
  };
};

module.exports = {
  buildFollowUpSchedule
};
