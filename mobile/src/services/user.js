import axios from 'axios';
import { getToken } from './auth';
import config from '../utils/config';

const API_URL = `${config.API_URL}/users`;

export const searchUsers = async (query) => {
  const token = await getToken();
  try {
    const response = await axios.get(`${API_URL}/search?query=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const sendFriendRequest = async (receiverId) => {
  const token = await getToken();
  try {
    const response = await axios.post(`${API_URL}/friend-request`, { receiverId }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getFriends = async () => {
    const token = await getToken();
    try {
        const response = await axios.get(`${API_URL}/friends`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const getPendingRequests = async () => {
    const token = await getToken();
    try {
        const response = await axios.get(`${API_URL}/pending-requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const acceptFriendRequest = async (requestId) => {
    const token = await getToken();
    try {
        const response = await axios.post(`${API_URL}/accept-request`, { requestId }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const rejectFriendRequest = async (requestId) => {
    const token = await getToken();
    try {
        const response = await axios.post(`${API_URL}/reject-request`, { requestId }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export const removeFriend = async (friendId) => {
    const token = await getToken();
    try {
        const response = await axios.post(`${API_URL}/remove-friend`, { friendId }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};
