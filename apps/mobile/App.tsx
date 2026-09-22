import React, { Component, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { hasSession, clearSession } from './src/lib/api';
import { colors } from './src/theme';
import { Loading } from './src/components';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import MatchDetailScreen from './src/screens/MatchDetailScreen';
import ContestScreen from './src/screens/ContestScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import FantasyScreen from './src/screens/FantasyScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';

type Route =
  | 'Login'
  | 'Register'
  | 'Main'
  | 'MatchDetail'
  | 'Contest'
  | 'Leaderboard';

type Params = Record<string, any> | undefined;

class StartupErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.green, fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
            CRICKX
          </Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 8 }}>
            CrickX could not start
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
            Please close and reopen the app. Technical details:
          </Text>
          <Text style={{ color: colors.red, fontSize: 12, lineHeight: 18, marginTop: 12 }}>
            {this.state.error.message}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={{ marginTop: 18, backgroundColor: colors.green, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
          >
            <Text style={{ color: colors.greenDark, fontWeight: '900' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <StartupErrorBoundary>
      <CrickXApp />
    </StartupErrorBoundary>
  );
}

function CrickXApp() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [route, setRoute] = useState<Route>('Login');
  const [params, setParams] = useState<Params>(undefined);
  const [tab, setTab] = useState<'Matches' | 'Fantasy' | 'Wallet' | 'Profile'>('Matches');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await hasSession();
        if (!mounted) return;
        setLoggedIn(session);
        setRoute(session ? 'Main' : 'Login');
      } catch {
        if (!mounted) return;
        setLoggedIn(false);
        setRoute('Login');
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const navigation = useMemo(() => ({
    navigate: (name: string, nextParams?: Params) => {
      if (name === 'Profile') {
        setTab('Profile');
        setRoute('Main');
        setParams(undefined);
        return;
      }
      if (name === 'Main') {
        const requestedTab = nextParams?.screen;
        if (requestedTab === 'Fantasy' || requestedTab === 'Wallet' || requestedTab === 'Profile' || requestedTab === 'Matches') {
          setTab(requestedTab);
        }
        setRoute('Main');
        setParams(nextParams?.params);
        return;
      }
      setRoute(name as Route);
      setParams(nextParams);
    },
    replace: (name: string, nextParams?: Params) => {
      if (name === 'Main') {
        const requestedTab = nextParams?.screen;
        if (requestedTab === 'Fantasy' || requestedTab === 'Wallet' || requestedTab === 'Profile' || requestedTab === 'Matches') {
          setTab(requestedTab);
        }
        setRoute('Main');
        setParams(nextParams?.params);
        setLoggedIn(true);
        return;
      }
      setRoute(name as Route);
      setParams(nextParams);
    },
    goBack: () => {
      if (route === 'Register') {
        setRoute('Login');
        setParams(undefined);
      } else if (route !== 'Main') {
        setRoute('Main');
        setParams(undefined);
      }
    },
  }), [route]);

  if (!ready) return <Loading />;

  if (route === 'Login') return <LoginScreen navigation={navigation} />;
  if (route === 'Register') return <RegisterScreen navigation={navigation} />;
  if (route === 'MatchDetail') return <MatchDetailScreen route={{ params }} navigation={navigation} />;
  if (route === 'Contest') return <ContestScreen route={{ params }} navigation={navigation} />;
  if (route === 'Leaderboard') return <LeaderboardScreen route={{ params }} navigation={navigation} />;

  return (
    <MainTabs
      activeTab={tab}
      setActiveTab={setTab}
      navigation={navigation}
      params={params}
      onSignOut={async () => {
        await clearSession();
        setLoggedIn(false);
        setRoute('Login');
        setTab('Matches');
        setParams(undefined);
      }}
    />
  );
}

function MainTabs({
  activeTab,
  setActiveTab,
  navigation,
  params,
  onSignOut,
}: {
  activeTab: 'Matches' | 'Fantasy' | 'Wallet' | 'Profile';
  setActiveTab: (tab: 'Matches' | 'Fantasy' | 'Wallet' | 'Profile') => void;
  navigation: any;
  params: Params;
  onSignOut: () => void;
}) {
  const tabs = [
    { id: 'Matches' as const, label: 'Matches' },
    { id: 'Fantasy' as const, label: 'Fantasy' },
    { id: 'Wallet' as const, label: 'Wallet' },
    { id: 'Profile' as const, label: 'Profile' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {activeTab === 'Matches' && <MatchesScreen navigation={navigation} />}
        {activeTab === 'Fantasy' && <FantasyScreen navigation={navigation} route={{ params: params ?? {} }} />}
        {activeTab === 'Wallet' && <WalletScreen navigation={navigation} />}
        {activeTab === 'Profile' && <ProfileScreen navigation={navigation} onSignOut={onSignOut} />}
      </View>

      <View style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: 10,
        paddingHorizontal: 8,
      }}>
        {tabs.map((item) => {
          const active = item.id === activeTab;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setActiveTab(item.id)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: active ? colors.green : colors.muted, fontSize: 11, fontWeight: '900' }}>
                {active ? '● ' : ''}{item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
