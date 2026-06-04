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
    // For voice, append the file
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

  try {
    const response = await fetch(`${API_URL}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });
    
    if (!response.ok) {
      let errorData;
      const errorText = await response.text();
      try { 
        errorData = JSON.parse(errorText); 
      } catch(e) { 
        errorData = { message: errorText || response.statusText }; 
      }
      throw errorData;
    }

    return await response.json();
  } catch (error) {
    throw error.message ? error : new Error(String(error));
  }
};
