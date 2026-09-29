import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://crickx-3d806.web.app';
const START_URL = WEB_URL.replace(/\/$/, '') + '/matches';
const ALLOWED_HOSTS = new Set(['crickx-3d806.web.app', 'crickx-3d806.firebaseapp.com']);

const TABS = [
  { path: '/matches', label: 'Matches', icon: '◉' },
  { path: '/fantasy-home', label: 'Fantasy', icon: '✦' },
  { path: '/wallet', label: 'Wallet', icon: '◈' },
  { path: '/subscription', label: 'Subscribe', icon: '＋' },
  { path: '/profile', label: 'Profile', icon: '◎' },
] as const;

const NATIVE_SHELL_CSS = ".site-header,.mobile-bottom-nav,footer{display:none !important;}html,body{background:#080b10 !important;margin:0 !important;padding:0 !important;overflow-x:hidden !important;}html.crickx-native-app .page-shell,html.crickx-native-app .app-page,html.crickx-native-app .profile-page{padding:0 10px !important;min-height:100vh !important;}html.crickx-native-app .card{box-shadow:none !important;transform:none !important;}";

function tabForUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return TABS.find((tab) => pathname === tab.path || pathname.startsWith(tab.path + '/'))?.path ?? null;
  } catch {
    return null;
  }
}

function titleForTab(path: string | null) {
  return TABS.find((tab) => tab.path === path)?.label ?? 'CrickX';
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(START_URL);
  const [activeTab, setActiveTab] = useState<string | null>('/matches');
  const [exitHintVisible, setExitHintVisible] = useState(false);
  const initialLoadComplete = useRef(false);
  const exitHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        setExitHintVisible(false);
        return true;
      }

      if (exitHintVisible) {
        return false;
      }

      setExitHintVisible(true);
      if (exitHintTimer.current) clearTimeout(exitHintTimer.current);
      exitHintTimer.current = setTimeout(() => setExitHintVisible(false), 1800);
      return true;
    });

    return () => {
      subscription.remove();
      if (exitHintTimer.current) clearTimeout(exitHintTimer.current);
    };
  }, [canGoBack, exitHintVisible]);

  function navigate(path: string) {
    const target = WEB_URL.replace(/\/$/, '') + path;
    setActiveTab(path);
    setExitHintVisible(false);
    setLoading(true);
    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(target)}; true;`,
    );
  }

  function refresh() {
    setRefreshing(true);
    webViewRef.current?.reload();
  }

  function handleNavigationRequest(request: WebViewNavigation) {
    const url = request.url;
    if (url.startsWith('about:blank') || url.startsWith('blob:')) return true;

    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      host = '';
    }

    if (host && ALLOWED_HOSTS.has(host)) return true;

    // Never render third-party web pages inside the app shell. Open only
    // explicitly allowed external destinations in the system/browser.
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol.toLowerCase();
      const allowedExternalProtocols = new Set(['https:', 'mailto:', 'tel:', 'metamask:', 'wc:']);
      if (allowedExternalProtocols.has(protocol)) {
        void Linking.openURL(url).catch(() => undefined);
      }
    } catch {
      // Ignore malformed or unsupported navigation targets.
    }

    return false;
  }

  if (failed) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#080b10" />
        <View style={styles.errorShell}>
          <Image source={require('./assets/crickx-original-icon.png')} style={styles.errorLogo} />
          <Text style={styles.brand}>CRICKX</Text>
          <Text style={styles.title}>We couldn't open CrickX</Text>
          <Text style={styles.message}>{failed}</Text>
          <Pressable
            onPress={() => {
              setFailed(null);
              setLoading(true);
              setCurrentUrl(START_URL);
              setActiveTab('/matches');
              webViewRef.current?.reload();
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  let currentHost = '';
  try { currentHost = new URL(currentUrl).hostname.toLowerCase(); } catch { currentHost = ''; }
  const isCrickXPage = ALLOWED_HOSTS.has(currentHost);
  const screenTitle = titleForTab(activeTab);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080b10" />
      <View style={styles.appShell}>
        {isCrickXPage && (
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              {canGoBack && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={() => {
                    setExitHintVisible(false);
                    webViewRef.current?.goBack();
                  }}
                  style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.backIcon}>‹</Text>
                </Pressable>
              )}
              <Image source={require('./assets/crickx-original-icon.png')} style={styles.logo} />
              <View style={styles.headerCopy}>
                <Text style={styles.brand}>CRICKX</Text>
                <Text style={styles.sectionTitle} numberOfLines={1}>{screenTitle}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh current page"
              onPress={refresh}
              style={({ pressed }) => [styles.refreshButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.refreshIcon}>{refreshing ? '…' : '↻'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.webContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: START_URL }}
            style={styles.web}
            originWhitelist={['https://*', 'about:blank']}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled={false}
            mixedContentMode="never"
            sharedCookiesEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            injectedJavaScriptBeforeContentLoaded={`
              (function() {
                document.documentElement.classList.add('crickx-native-app');
                var style = document.createElement('style');
                style.id = 'crickx-native-shell';
                style.innerHTML = ${JSON.stringify(NATIVE_SHELL_CSS)};
                document.documentElement.appendChild(style);
              })();
              true;
            `}
            injectedJavaScript={`
              (function() {
                document.documentElement.classList.add('crickx-native-app');
                var style = document.getElementById('crickx-native-shell');
                if (!style) {
                  style = document.createElement('style');
                  style.id = 'crickx-native-shell';
                  style.innerHTML = ${JSON.stringify(NATIVE_SHELL_CSS)};
                  document.documentElement.appendChild(style);
                }
              })();
              true;
            `}
            onNavigationStateChange={(state) => {
              const nextUrl = state.url || WEB_URL;
              setCurrentUrl(nextUrl);
              setCanGoBack(state.canGoBack);
              if (ALLOWED_HOSTS.has(new URL(nextUrl).hostname.toLowerCase())) {
                const nextTab = tabForUrl(nextUrl);
                if (nextTab) setActiveTab(nextTab);
              }
            }}
            onShouldStartLoadWithRequest={handleNavigationRequest}
            onLoadStart={() => {
              if (!initialLoadComplete.current) {
                setLoading(true);
                setFailed(null);
              }
            }}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress >= 0.35) setLoading(false);
            }}
            onLoadEnd={() => {
              initialLoadComplete.current = true;
              setLoading(false);
              setRefreshing(false);
            }}
            onError={(event) => {
              setLoading(false);
              setRefreshing(false);
              if (!initialLoadComplete.current) {
                setFailed(event.nativeEvent.description || 'Unable to connect to CrickX.');
              }
            }}
            onHttpError={(event) => {
              const status = event.nativeEvent.statusCode;
              const url = event.nativeEvent.url || '';
              if (status >= 500 && url.startsWith(WEB_URL)) {
                setFailed(`CrickX page returned HTTP ${status}.`);
              }
            }}
            onContentProcessDidTerminate={() => {
              webViewRef.current?.reload();
            }}
            cacheEnabled
            androidLayerType="hardware"
            textZoom={100}
            overScrollMode="never"
          />

          {loading && (
            <View style={styles.loading}>
              <Image source={require('./assets/crickx-original-icon.png')} style={styles.loadingLogo} />
              <Text style={styles.loadingBrand}>CRICKX</Text>
              <ActivityIndicator size="small" color="#9bf34a" style={{ marginTop: 14 }} />
              <Text style={styles.loadingText}>Loading {screenTitle}…</Text>
            </View>
          )}
        </View>

        {exitHintVisible && isCrickXPage && (
          <View style={styles.exitHint} pointerEvents="none">
            <Text style={styles.exitHintText}>Press back again to exit CrickX</Text>
          </View>
        )}

        {isCrickXPage && (
          <View style={styles.bottomBar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.path;
              return (
                <Pressable
                  key={tab.path}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                  onPress={() => navigate(tab.path)}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.tabActive,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080b10' },
  appShell: { flex: 1, backgroundColor: '#080b10' },
  topBar: {
    minHeight: 62,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 9,
    backgroundColor: '#0b0f16',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.075)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  headerCopy: { minWidth: 0, flex: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111721',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
    marginRight: 8,
  },
  backIcon: { color: '#f1f5f9', fontSize: 31, lineHeight: 32, fontWeight: '500', marginTop: -2 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 11,
    marginRight: 11,
    backgroundColor: '#121822',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  brand: { color: '#9bf34a', fontWeight: '900', letterSpacing: 2.8, fontSize: 11 },
  sectionTitle: { color: '#f3f6fb', fontWeight: '900', fontSize: 16, marginTop: 1, letterSpacing: 0.05 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131923',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.09)',
    marginLeft: 12,
  },
  refreshIcon: { color: '#dfe7ef', fontSize: 25, lineHeight: 27, fontWeight: '700' },
  webContainer: { flex: 1, backgroundColor: '#080b10' },
  web: { flex: 1, backgroundColor: '#080b10' },
  bottomBar: {
    minHeight: 76,
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: 8,
    flexDirection: 'row',
    backgroundColor: '#0a0e15',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.08)',
    shadowColor: '#000',
    shadowOpacity: 0.30,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  tab: {
    flex: 1,
    minHeight: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    position: 'relative',
  },
  tabActive: { backgroundColor: 'rgba(155,243,74,.10)', borderWidth: 1, borderColor: 'rgba(155,243,74,.08)' },
  tabIcon: { color: '#7f8999', fontSize: 18, lineHeight: 21, fontWeight: '900' },
  tabIconActive: { color: '#9bf34a' },
  tabLabel: { color: '#7f8999', fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 0.1 },
  tabLabelActive: { color: '#9bf34a' },
  exitHint: {
    position: 'absolute',
    zIndex: 30,
    left: 24,
    right: 24,
    bottom: 87,
    alignItems: 'center',
  },
  exitHintText: {
    color: '#eef3f8',
    backgroundColor: 'rgba(18,23,32,.96)',
    borderColor: 'rgba(255,255,255,.10)',
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 14,
    fontSize: 12,
    fontWeight: '800',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#080b10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: { width: 78, height: 78, borderRadius: 22 },
  loadingBrand: { color: '#9bf34a', fontWeight: '900', letterSpacing: 4, fontSize: 14, marginTop: 12 },
  loadingText: { color: '#96a0b3', fontSize: 13, marginTop: 8 },
  errorShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#080b10',
  },
  errorLogo: { width: 82, height: 82, borderRadius: 24 },
  title: { color: '#f4f7fb', fontSize: 27, fontWeight: '900', marginTop: 17, textAlign: 'center', letterSpacing: -0.4 },
  message: { color: '#96a0b3', fontSize: 14, lineHeight: 21, marginTop: 10, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#9bf34a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 22,
    minWidth: 150,
  },
  primaryButtonText: { color: '#12220a', fontWeight: '900', fontSize: 14 },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
