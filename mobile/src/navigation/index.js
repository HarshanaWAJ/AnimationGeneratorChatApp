import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatList from '../screens/ChatList';
import SearchScreen from '../screens/SearchScreen';
import ChatRoom from '../screens/ChatRoom';

const Stack = createStackNavigator();

export default function AppNavigation({ isAuthenticated }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="ChatList" component={ChatList} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="ChatRoom" component={ChatRoom} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
