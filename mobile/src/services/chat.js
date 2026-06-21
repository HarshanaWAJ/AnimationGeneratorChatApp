import axios from 'axios';
import { Platform } from 'react-native';
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
    // For voice, append the file properly based on platform
    if (Platform.OS === 'web') {
      try {
        const fetchRes = await fetch(messageData.audioUri);
        const blob = await fetchRes.blob();
        formData.append('audio', blob, 'voice.m4a');
      } catch (err) {
        console.error('Failed to convert audio URI to Blob on web:', err);
      }
    } else {
      let audioUri = messageData.audioUri;
      if (Platform.OS === 'android' && !audioUri.startsWith('file://') && !audioUri.startsWith('content://')) {
        audioUri = `file://${audioUri}`;
      }

      formData.append('audio', {
        uri: audioUri,
        name: 'voice.m4a',
        type: 'audio/m4a',
      });
    }
  }

  try {
    const response = await axios.post(`${API_URL}/send`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    }
    throw error.message ? error : new Error(String(error));
  }
};
