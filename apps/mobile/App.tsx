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
const ALLOWED_HOST = 'crickx-3d806.web.app';

const TABS = [
  { path: '/matches', label: 'Matches', icon: '▤' },
  { path: '/fantasy-home', label: 'Fantasy', icon: '✦' },
  { path: '/wallet', label: 'Wallet', icon: '▣' },
  { path: '/subscription', label: 'Subscribe', icon: '+' },
  { path: '/profile', label: 'Profile', icon: '●' },
] as const;

const NATIVE_SHELL_CSS = ".site-header,.mobile-bottom-nav,footer{display:none !important;}html,body{background:#080b10 !important;margin:0 !important;padding:0 !important;overflow-x:hidden !important;}html.crickx-native-app .page-shell{padding:0 !important;min-height:100vh !important;}";

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
  const [currentUrl, setCurrentUrl] = useState(WEB_URL);
  const [activeTab, setActiveTab] = useState<string | null>('/matches');
  const initialLoadComplete = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  function navigate(path: string) {
    const target = WEB_URL.replace(/\/$/, '') + path;
    setActiveTab(path);
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
    if (
      /\\.apk(?:$|[?#])/i.test(url) ||
      url.startsWith('metamask:') ||
      (!url.startsWith('http://') &&
        !url.startsWith('https://') &&
        !url.startsWith('about:blank') &&
        !url.startsWith('blob:'))
    ) {
      void Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return true;
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
              setCurrentUrl(WEB_URL);
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

  const isCrickXPage =
    currentUrl.startsWith('https://' + ALLOWED_HOST) ||
    currentUrl.startsWith('http://' + ALLOWED_HOST);
  const screenTitle = titleForTab(activeTab);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080b10" />
      <View style={styles.appShell}>
        {isCrickXPage && (
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <Image source={require('./assets/crickx-original-icon.png')} style={styles.logo} />
              <View>
                <Text style={styles.brand}>CRICKX</Text>
                <Text style={styles.sectionTitle}>{screenTitle}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
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
            source={{ uri: WEB_URL }}
            style={styles.web}
            originWhitelist={['http://*', 'https://*', 'metamask:*', '*://*/*']}
            javaScriptEnabled
            domStorageEnabled
            databaseEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            injectedJavaScriptBeforeContentLoaded={`
              (function() {
                document.documentElement.classList.add('crickx-native-app');
                var style = document.createElement('style');
                style.id = 'crickx-native-shell';
                style.innerHTML = ".site-header,.mobile-bottom-nav,footer{display:none !important;}html,body{background:#080b10 !important;margin:0 !important;padding:0 !important;overflow-x:hidden !important;}.page-shell{padding-bottom:0 !important;min-height:100vh !important;}";
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
                  style.innerHTML = ".site-header,.mobile-bottom-nav,footer{display:none !important;}html,body{background:#080b10 !important;margin:0 !important;padding:0 !important;overflow-x:hidden !important;}.page-shell{padding-bottom:0 !important;min-height:100vh !important;}";
                  document.documentElement.appendChild(style);
                }
              })();
              true;
            `}
            onNavigationStateChange={(state) => {
              const nextUrl = state.url || WEB_URL;
              setCurrentUrl(nextUrl);
              setCanGoBack(state.canGoBack);
              if (nextUrl.includes(ALLOWED_HOST)) {
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
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0b0f16',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, borderRadius: 12, marginRight: 11 },
  brand: { color: '#9bf34a', fontWeight: '900', letterSpacing: 2.8, fontSize: 12 },
  sectionTitle: { color: '#f3f6fb', fontWeight: '800', fontSize: 17, marginTop: 1 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131923',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  refreshIcon: { color: '#dfe7ef', fontSize: 25, lineHeight: 27, fontWeight: '700' },
  webContainer: { flex: 1, backgroundColor: '#080b10' },
  web: { flex: 1, backgroundColor: '#080b10' },
  bottomBar: {
    minHeight: 72,
    paddingHorizontal: 6,
    paddingTop: 7,
    paddingBottom: 8,
    flexDirection: 'row',
    backgroundColor: '#0b0f16',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.08)',
  },
  tab: {
    flex: 1,
    minHeight: 58,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  tabActive: { backgroundColor: 'rgba(155,243,74,.11)' },
  tabIcon: { color: '#7f8999', fontSize: 19, lineHeight: 22, fontWeight: '800' },
  tabIconActive: { color: '#9bf34a' },
  tabLabel: { color: '#7f8999', fontSize: 10.5, fontWeight: '700', marginTop: 4 },
  tabLabelActive: { color: '#9bf34a' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#080b10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: { width: 76, height: 76, borderRadius: 22 },
  loadingBrand: { color: '#9bf34a', fontWeight: '900', letterSpacing: 4, fontSize: 14, marginTop: 12 },
  loadingText: { color: '#96a0b3', fontSize: 13, marginTop: 8 },
  errorShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#080b10',
  },
  errorLogo: { width: 78, height: 78, borderRadius: 23 },
  title: { color: '#f4f7fb', fontSize: 27, fontWeight: '900', marginTop: 17, textAlign: 'center' },
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
