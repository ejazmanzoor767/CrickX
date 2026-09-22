import React, { Component, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

type Route =
  | 'Login'
  | 'Register'
  | 'Main'
  | 'MatchDetail'
  | 'Contest'
  | 'Leaderboard';

type Params = Record<string, any> | undefined;

const BG = '#080b10';
const SURFACE = '#111722';
const BORDER = 'rgba(255,255,255,.08)';
const TEXT = '#f4f7fb';
const MUTED = '#96a0b3';
const GREEN = '#9bf34a';
const GREEN_DARK = '#12220a';
const RED = '#ff6b6b';

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
        <View style={{ flex: 1, backgroundColor: BG, justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: GREEN, fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
            CRICKX
          </Text>
          <Text style={{ color: TEXT, fontSize: 26, fontWeight: '900', marginTop: 8 }}>
            CrickX could not start
          </Text>
          <Text style={{ color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
            The app reached its error screen. Technical details:
          </Text>
          <Text style={{ color: RED, fontSize: 12, lineHeight: 18, marginTop: 12 }}>
            {this.state.error.message || String(this.state.error)}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ error: null })}
            style={{ marginTop: 18, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
          >
            <Text style={{ color: GREEN_DARK, fontWeight: '900' }}>Try Again</Text>
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
  const [route, setRoute] = useState<Route>('Login');
  const [params, setParams] = useState<Params>(undefined);
  const [tab, setTab] = useState<'Matches' | 'Fantasy' | 'Wallet' | 'Profile'>('Matches');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Lazy-load storage/API only after the first React render.
        const { hasSession } = require('./src/lib/api') as typeof import('./src/lib/api');
        const session = await hasSession();
        if (!mounted) return;
        setRoute(session ? 'Main' : 'Login');
      } catch {
        if (!mounted) return;
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
        if (
          requestedTab === 'Fantasy' ||
          requestedTab === 'Wallet' ||
          requestedTab === 'Profile' ||
          requestedTab === 'Matches'
        ) {
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
        if (
          requestedTab === 'Fantasy' ||
          requestedTab === 'Wallet' ||
          requestedTab === 'Profile' ||
          requestedTab === 'Matches'
        ) {
          setTab(requestedTab);
        }
        setRoute('Main');
        setParams(nextParams?.params);
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

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: GREEN, fontSize: 30, fontWeight: '900', letterSpacing: 4 }}>CRICKX</Text>
        <Text style={{ color: MUTED, marginTop: 8, fontSize: 13 }}>Starting app…</Text>
        <ActivityIndicator size="small" color={GREEN} style={{ marginTop: 16 }} />
      </View>
    );
  }

  try {
    if (route === 'Login') {
      const LoginScreen = require('./src/screens/LoginScreen').default;
      return <LoginScreen navigation={navigation} />;
    }
    if (route === 'Register') {
      const RegisterScreen = require('./src/screens/RegisterScreen').default;
      return <RegisterScreen navigation={navigation} />;
    }
    if (route === 'MatchDetail') {
      const MatchDetailScreen = require('./src/screens/MatchDetailScreen').default;
      return <MatchDetailScreen route={{ params }} navigation={navigation} />;
    }
    if (route === 'Contest') {
      const ContestScreen = require('./src/screens/ContestScreen').default;
      return <ContestScreen route={{ params }} navigation={navigation} />;
    }
    if (route === 'Leaderboard') {
      const LeaderboardScreen = require('./src/screens/LeaderboardScreen').default;
      return <LeaderboardScreen route={{ params }} navigation={navigation} />;
    }

    return (
      <MainTabs
        activeTab={tab}
        setActiveTab={setTab}
        navigation={navigation}
        params={params}
        onSignOut={async () => {
          try {
            const { clearSession } = require('./src/lib/api') as typeof import('./src/lib/api');
            await clearSession();
          } finally {
            setRoute('Login');
            setTab('Matches');
            setParams(undefined);
          }
        }}
      />
    );
  } catch (error) {
    throw error;
  }
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
  let Screen: any;
  if (activeTab === 'Matches') Screen = require('./src/screens/MatchesScreen').default;
  if (activeTab === 'Fantasy') Screen = require('./src/screens/FantasyScreen').default;
  if (activeTab === 'Wallet') Screen = require('./src/screens/WalletScreen').default;
  if (activeTab === 'Profile') Screen = require('./src/screens/ProfileScreen').default;

  const screenProps =
    activeTab === 'Fantasy'
      ? { navigation, route: { params: params ?? {} } }
      : activeTab === 'Profile'
        ? { navigation, onSignOut }
        : { navigation };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ flex: 1 }}>
        <Screen {...screenProps} />
      </View>

      <View style={{
        flexDirection: 'row',
        backgroundColor: SURFACE,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        paddingTop: 8,
        paddingBottom: 10,
        paddingHorizontal: 8,
      }}>
        {(['Matches', 'Fantasy', 'Wallet', 'Profile'] as const).map((item) => {
          const active = item === activeTab;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => setActiveTab(item)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: active ? GREEN : MUTED, fontSize: 11, fontWeight: '900' }}>
                {active ? '● ' : ''}{item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
