import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { hasSession } from './src/lib/api';
import { colors } from './src/theme';
import { Loading } from './src/components';
import LoginScreen from './src/screens/LoginScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import ContestScreen from './src/screens/ContestScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import FantasyScreen from './src/screens/FantasyScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 66, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontWeight: '800', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="Matches" component={MatchesScreen} />
      <Tabs.Screen name="Fantasy" component={FantasyScreen} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    hasSession().then((value) => { setLoggedIn(value); setReady(true); });
  }, []);

  if (!ready) return <Loading />;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={loggedIn ? 'Main' : 'Login'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
        <Stack.Screen name="Contest" component={ContestScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
