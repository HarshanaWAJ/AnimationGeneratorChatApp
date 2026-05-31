import axios from 'axios';
import { getToken } from './auth';
import config from '../utils/config';

const API_URL = `${config.API_URL}/messages`;

export const getMessages = async (otherUserId) => {
  const token = await getToken();
  try {
    const response = await axios.get(`${API_URL}/${otherUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const sendMessage = async (messageData) => {
  const token = await getToken();
  const formData = new FormData();
  
  formData.append('receiverId', messageData.receiverId);
  formData.append('type', messageData.type);
  
  if (messageData.type === 'text') {
    formData.append('text', messageData.text);
  } else {
    // For voice, append the file
    formData.append('audio', {
      uri: messageData.audioUri,
      name: 'voice.m4a',
      type: 'audio/m4a',
    });
  }

  try {
    const response = await axios.post(`${API_URL}/send`, formData, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 360000, // 6 minutes — GIF generation can take 80+ seconds
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
