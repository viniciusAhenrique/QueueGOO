import { Stack } from 'expo-router';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PushNotificationBootstrap } from './components/PushNotificationBootstrap';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PushNotificationBootstrap />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
