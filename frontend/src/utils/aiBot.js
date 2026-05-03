import api from './api';

/**
 * Sends a message to the AI counselling backend.
 * Returns the full response object so callers can inspect:
 *   - reply          {string}  — AI-generated response text
 *   - crisisDetected {boolean} — true if the backend detected a crisis keyword
 *   - crisisAlertId  {string|null} — UUID of the inserted crisis_alerts row
 */
export async function sendCounsellingMessage(message, history = [], isAnonymous = false) {
  try {
    const normalizedHistory = history
      .filter(m => m.role === 'user' || m.role === 'bot' || m.role === 'assistant')
      .map(m => ({
        role: m.role === 'bot' ? 'assistant' : m.role,
        content: m.content || m.text || ''
      }));

    const response = await api.post('/chat', { message, history: normalizedHistory, isAnonymous });
    // Return full data object so AICounselling.js can read crisisDetected
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to connect to the counselling service.');
  }
}
