import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://crickx-3d806.web.app';
const ALLOWED_HOST = 'crickx-3d806.web.app';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
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

  function handleNavigationRequest(request: WebViewNavigation) {
    const url = request.url;

    // Keep CrickX and HTTPS payment/checkout pages inside the APK.
    // Native wallet/deeplink URLs are handed to Android.
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('about:blank') ||
      url.startsWith('blob:')
    ) {
      return true;
    }

    void Linking.openURL(url).catch(() => undefined);
    return false;
  }

  if (failed) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#080b10" />
        <View style={styles.errorBox}>
          <Text style={styles.brand}>CRICKX</Text>
          <Text style={styles.title}>CrickX could not load</Text>
          <Text style={styles.message}>{failed}</Text>
          <TouchableOpacity
            onPress={() => {
              setFailed(null);
              setLoading(true);
              webViewRef.current?.reload();
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080b10" />
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
          onNavigationStateChange={(state) => {
            setCanGoBack(state.canGoBack);
          }}
          onShouldStartLoadWithRequest={handleNavigationRequest}
          onLoadStart={() => {
            // Show the native splash only for the first document load.
            // Internal Next.js route changes should never cover the app with
            // a permanent native loading screen.
            if (!initialLoadComplete.current) {
              setLoading(true);
              setFailed(null);
            }
          }}
          onLoadProgress={({ nativeEvent }) => {
            // Android WebView can emit a second load-start during history/
            // client navigation without a matching load-end. Once the page
            // has made real progress, do not keep the native overlay up.
            if (nativeEvent.progress >= 0.35) setLoading(false);
          }}
          onLoadEnd={() => {
            initialLoadComplete.current = true;
            setLoading(false);
          }}
          onError={(event) => {
            setLoading(false);
            if (!initialLoadComplete.current) {
              setFailed(event.nativeEvent.description || 'Unable to connect to CrickX.');
            }
          }}
          onHttpError={(event) => {
            // Only treat an error on the main CrickX document as a page-load
            // failure. API/resource HTTP errors must remain inside the website.
            const status = event.nativeEvent.statusCode;
            const url = event.nativeEvent.url || '';
            if (status >= 500 && url.startsWith(WEB_URL)) {
              setFailed(`CrickX page returned HTTP ${status}.`);
            }
          }}
          cacheEnabled
          androidLayerType="hardware"
        />

        {loading && (
          <View style={styles.loading}>
            <Text style={styles.brand}>CRICKX</Text>
            <ActivityIndicator size="small" color="#9bf34a" style={{ marginTop: 12 }} />
            <Text style={styles.loadingText}>Loading CrickX…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080b10' },
  webContainer: { flex: 1, backgroundColor: '#080b10' },
  web: { flex: 1, backgroundColor: '#080b10' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#080b10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    color: '#9bf34a',
    fontWeight: '900',
    letterSpacing: 4,
    fontSize: 13,
  },
  loadingText: {
    color: '#96a0b3',
    fontSize: 13,
    marginTop: 8,
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#f4f7fb',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 10,
  },
  message: {
    color: '#96a0b3',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  button: {
    backgroundColor: '#9bf34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: {
    color: '#12220a',
    fontWeight: '900',
  },
});
