import api from './api';

export async function sendCounsellingMessage(message, history = []) {
  try {
    // History includes past conversation context to maintain memory
    const response = await api.post('/chat', { message, history });
    return response.data.reply;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to connect to the counselling service.');
  }
}
