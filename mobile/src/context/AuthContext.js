import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial check on boot
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userData = await AsyncStorage.getItem('user');
        if (token) {
          setIsAuthenticated(true);
          setUser(userData ? JSON.parse(userData) : null);
        }
      } catch (e) {
        console.error('Auth boot error:', e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const signIn = async (token, userData) => {
    try {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setIsAuthenticated(true);
      setUser(userData);
    } catch (e) {
      console.error('SignIn error:', e);
    }
  };

  const signOut = async () => {
    try {
      console.log('SignOut: Removing items and updating state');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setIsAuthenticated(false);
      setUser(null);
    } catch (e) {
      console.error('SignOut error:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
