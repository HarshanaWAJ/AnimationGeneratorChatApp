import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigation from './src/navigation';

function RootContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // Or a splash screen

  return <AppNavigation isAuthenticated={isAuthenticated} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
