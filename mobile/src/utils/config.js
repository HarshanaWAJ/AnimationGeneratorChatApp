import Constants from 'expo-constants';

// Get the IP address of the machine running the Metro bundler
const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';

const BASE_URL = `http://${localhost}:5000`; // Node backend port

export default {
  API_URL: `${BASE_URL}/api`,
  SOCKET_URL: BASE_URL,
  BASE_URL: BASE_URL
};
