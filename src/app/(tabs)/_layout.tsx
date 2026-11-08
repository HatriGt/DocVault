import React from 'react';
import { Tabs } from 'expo-router';
import { Easing } from 'react-native';
import { TabBar } from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Slide between tabs in their visual order (pairs with the swipe gesture).
        animation: 'shift',
        transitionSpec: { animation: 'timing', config: { duration: 260, easing: Easing.bezier(0.22, 1, 0.36, 1) } },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Favorites' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
