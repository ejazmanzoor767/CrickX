import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://crickxfantasy.site';
const START_URL = WEB_URL.replace(/\/$/, '') + '/matches';
const ALLOWED_HOSTS = new Set(['crickxfantasy.site', 'www.crickxfantasy.site', 'crickx-3d806.web.app', 'crickx-3d806.firebaseapp.com']);

function isAllowedCrickXUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const TABS = [
  { path: '/matches', label: 'Home', icon: '🏏' },
  { path: '/fantasy-home', label: 'Fantasy', icon: '✦' },
  { path: '/wallet', label: 'Wallet', icon: '▣' },
  { path: '/subscription', label: 'Subscribe', icon: '＋' },
  { path: '/profile', label: 'Profile', icon: '👤' },
] as const;

const NATIVE_SHELL_CSS = [
  ".site-header,.mobile-bottom-nav,footer{display:none !important;}",
  "html,body{background:#080b10 !important;margin:0 !important;padding:0 !important;overflow-x:hidden !important;overflow-y:auto !important;height:auto !important;min-height:100% !important;max-width:100% !important;touch-action:pan-y !important;-webkit-overflow-scrolling:touch !important;overscroll-behavior-y:auto !important;}",
  "html.crickx-native-app .page-shell,html.crickx-native-app .app-page,html.crickx-native-app .profile-page{padding:0 12px 16px !important;min-height:100% !important;max-width:100% !important;box-sizing:border-box !important;}",
  "html.crickx-native-app button,html.crickx-native-app .primary-button,html.crickx-native-app .secondary-button{min-width:0 !important;max-width:100% !important;box-sizing:border-box !important;touch-action:manipulation !important;}",
  "html.crickx-native-app input,html.crickx-native-app select,html.crickx-native-app textarea{max-width:100% !important;box-sizing:border-box !important;}",
  "html.crickx-native-app a{-webkit-tap-highlight-color:transparent !important;}",
  "html.crickx-native-app .card{box-shadow:none !important;transform:none !important;}",
  "#crickx-native-profile-resources{margin:16px 0 12px !important;padding:0 !important;overflow:hidden !important;border:1px solid rgba(155,243,74,.14) !important;background:linear-gradient(145deg,rgba(155,243,74,.07),rgba(18,23,34,.98)) !important;border-radius:20px !important;}",
  "#crickx-native-profile-resources .crx-res-head{padding:20px 18px 15px;border-bottom:1px solid rgba(255,255,255,.07);}",
  "#crickx-native-profile-resources .crx-res-eyebrow{margin:0 0 6px;color:#9bf34a;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;}",
  "#crickx-native-profile-resources .crx-res-title{margin:0;color:#f5f7fb;font-size:22px;font-weight:900;}",
  "#crickx-native-profile-resources .crx-res-sub{margin:6px 0 0;color:#98a2b4;font-size:12px;line-height:1.55;}",
  "#crickx-native-profile-resources .crx-res-section{padding:14px 12px 4px;}",
  "#crickx-native-profile-resources .crx-res-label{display:block;padding:0 4px 7px;color:#8892a5;font-size:9px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;}",
  "#crickx-native-profile-resources .crx-res-list{display:grid;gap:7px;}",
  "#crickx-native-profile-resources .crx-res-row{display:flex;align-items:center;gap:11px;width:100%;box-sizing:border-box;padding:12px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.022);color:#edf2f7;text-decoration:none;}",
  "#crickx-native-profile-resources .crx-res-row:active{opacity:.78;}",
  "#crickx-native-profile-resources .crx-res-icon{width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;border-radius:11px;background:rgba(155,243,74,.09);border:1px solid rgba(155,243,74,.12);font-size:16px;}",
  "#crickx-native-profile-resources .crx-res-copy{min-width:0;flex:1;}",
  "#crickx-native-profile-resources .crx-res-name{display:block;font-size:13px;font-weight:900;color:#f4f7fb;}",
  "#crickx-native-profile-resources .crx-res-value{display:block;margin-top:2px;font-size:11px;color:#98a2b4;overflow-wrap:anywhere;}",
  "#crickx-native-profile-resources .crx-res-arrow{color:#778297;font-size:18px;font-weight:800;padding-left:4px;}",
  "#crickx-native-profile-resources .crx-res-foot{padding:12px 16px 16px;color:#7e899d;font-size:10px;line-height:1.55;text-align:center;}",
  "html.crickx-native-app .match-live-card{padding:11px !important;margin-bottom:8px !important;}",
  "html.crickx-native-app .match-live-card .match-topline{min-height:20px !important;}",
  "html.crickx-native-app .match-live-card .match-teams{margin:10px 0 !important;gap:7px !important;}",
  "html.crickx-native-app .match-live-card .match-teams strong{font-size:20px !important;line-height:.95 !important;}",
  "html.crickx-native-app .match-live-card .match-teams img{width:22px !important;height:22px !important;margin-top:3px !important;}",
  "html.crickx-native-app .match-live-card .vs-badge{width:30px !important;height:30px !important;font-size:8px !important;}",
  "html.crickx-native-app .match-live-card .live-score-strip{margin-top:2px !important;padding:0 9px !important;border-radius:11px !important;}",
  "html.crickx-native-app .match-live-card .live-score-strip > div{padding:6px 0 !important;gap:10px !important;}",
  "html.crickx-native-app .match-live-card .live-score-strip strong{font-size:16px !important;}",
  "html.crickx-native-app .match-live-card .match-footer{flex-direction:row !important;gap:7px !important;padding-top:8px !important;}",
  "html.crickx-native-app .match-live-card .match-footer > div:first-child{display:none !important;}",
  "html.crickx-native-app .match-live-card .match-footer > div:last-child{width:100% !important;display:grid !important;grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;gap:7px !important;}",
  "html.crickx-native-app .match-live-card .match-footer .primary-button,html.crickx-native-app .match-live-card .match-footer .secondary-button{min-height:38px !important;padding:8px 9px !important;font-size:11px !important;}",
  "html.crickx-native-app .match-centre-intro{margin-bottom:6px !important;}",
  "html.crickx-native-app .match-centre-tabs{height:auto !important;min-height:0 !important;margin-top:0 !important;margin-bottom:3px !important;padding:5px !important;overflow:visible !important;}",
  "html.crickx-native-app .match-centre-tabs > div{height:auto !important;min-height:0 !important;}",
  "html.crickx-native-app .match-centre-tabs button{min-height:40px !important;padding:8px 6px !important;font-size:10.5px !important;}",
  "html.crickx-native-app .match-list{gap:5px !important;margin-top:0 !important;padding-top:0 !important;}",
  "html.crickx-native-app .match-list-card.match-live-card{min-height:0 !important;height:auto !important;padding:10px !important;margin:0 !important;}",
  "html.crickx-native-app .match-live-card .match-topline{margin:0 !important;padding:0 !important;min-height:18px !important;}",
  "html.crickx-native-app .match-live-card .match-teams{margin:7px 0 !important;gap:6px !important;}",
  "html.crickx-native-app .match-live-card .match-teams strong{font-size:18px !important;line-height:.95 !important;}",
  "html.crickx-native-app .match-live-card .match-teams small{font-size:7.5px !important;margin-bottom:3px !important;}",
  "html.crickx-native-app .match-live-card .match-teams img{width:20px !important;height:20px !important;margin-top:3px !important;}",
  "html.crickx-native-app .match-live-card .vs-badge{width:28px !important;height:28px !important;font-size:8px !important;}",
  "html.crickx-native-app .match-live-card .live-score-strip{margin:0 !important;padding:0 8px !important;}",
  "html.crickx-native-app .match-live-card .live-score-strip > div{padding:4px 0 !important;gap:7px !important;}",
  "html.crickx-native-app .match-live-card .live-score-strip strong{font-size:15px !important;}",
  "html.crickx-native-app .match-live-card .match-footer{padding-top:6px !important;margin-top:6px !important;gap:5px !important;}",
  "html.crickx-native-app .match-live-card .match-footer > div:last-child{gap:5px !important;}",
  "html.crickx-native-app .match-live-card .match-footer .primary-button,html.crickx-native-app .match-live-card .match-footer .secondary-button{min-height:34px !important;padding:7px 6px !important;font-size:10.5px !important;border-radius:10px !important;}",
  "html.crickx-native-app,html.crickx-native-app body{overflow-x:hidden !important;overflow-y:auto !important;height:auto !important;min-height:100% !important;}",
  "html.crickx-native-app body{touch-action:pan-y !important;-webkit-overflow-scrolling:touch !important;overscroll-behavior-y:auto !important;}",
  "html.crickx-native-app body>div{min-height:100% !important;height:auto !important;overflow:visible !important;}",
  "html.crickx-native-app .page-shell,html.crickx-native-app .app-page{height:auto !important;min-height:0 !important;overflow:visible !important;}",
  "html.crickx-native-app .leaderboard-page{gap:10px !important;padding-bottom:22px !important;}",
  "html.crickx-native-app .leaderboard-page> .card{border-radius:18px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-podium{grid-template-columns:minmax(0,1fr) minmax(0,1.14fr) minmax(0,1fr) !important;gap:6px !important;padding:14px 10px 16px !important;align-items:end !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-podium img,html.crickx-native-app .leaderboard-page .leaderboard-podium>div>div:first-child>div{max-width:68px !important;max-height:68px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-podium>div:nth-child(2) img,html.crickx-native-app .leaderboard-page .leaderboard-podium>div:nth-child(2)>div>div:first-child>div{max-width:76px !important;max-height:76px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-podium>div>div:last-child{font-size:11px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-podium span[style*='min-width: 84px']{min-width:66px !important;padding:5px 9px !important;font-size:13px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-row{grid-template-columns:38px minmax(0,1fr) 60px !important;gap:7px !important;min-height:66px !important;padding:0 12px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-row img,html.crickx-native-app .leaderboard-page .leaderboard-row>div>div{width:40px !important;height:40px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-row span{font-size:13px !important;}",
  "html.crickx-native-app .leaderboard-page .leaderboard-row>strong{font-size:15px !important;}",
  "html.crickx-native-app .match-detail-page{gap:9px !important;padding-bottom:24px !important;}",
  "html.crickx-native-app .match-detail-page>.card{margin-bottom:8px !important;}",
  "html.crickx-native-app .match-detail-page .match-title{font-size:22px !important;line-height:1.08 !important;}",
  "html.crickx-native-app .match-detail-page .match-summary-grid{display:grid !important;grid-template-columns:1fr !important;gap:8px !important;margin-bottom:8px !important;}",
  "html.crickx-native-app .match-detail-page .match-summary-grid .card{margin-bottom:0 !important;padding:12px !important;}",
  "html.crickx-native-app .match-detail-page .match-fow-grid{grid-template-columns:1fr !important;gap:8px !important;margin-top:8px !important;}",
  "html.crickx-native-app .match-detail-page .match-fow-grid>.card{margin-bottom:0 !important;padding:12px !important;}",
  "html.crickx-native-app .match-detail-page .scorecard-actions{display:none !important;}",
  "html.crickx-native-app .match-detail-page .chase-summary{margin-bottom:8px !important;}",
  "html.crickx-native-app .match-detail-page .chase-summary>div{grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:7px !important;}",
  "html.crickx-native-app .match-detail-page .chase-summary strong{font-size:27px !important;line-height:1 !important;}",
  "html.crickx-native-app .match-detail-page .chase-summary .muted-label{font-size:9px !important;}",
  "html.crickx-native-app .match-detail-page .card[style*='overflow: hidden']>div[style*='overflowX']{overflow-x:auto !important;-webkit-overflow-scrolling:touch !important;touch-action:pan-x pan-y !important;}",
  "html.crickx-native-app .match-detail-page table{min-width:590px !important;width:max-content !important;}",
  "html.crickx-native-app .match-detail-page th,html.crickx-native-app .match-detail-page td{padding:9px 8px !important;font-size:11px !important;}",
  "html.crickx-native-app .match-detail-page th:nth-child(4),html.crickx-native-app .match-detail-page td:nth-child(4),html.crickx-native-app .match-detail-page th:nth-child(5),html.crickx-native-app .match-detail-page td:nth-child(5){display:table-cell !important;}",
  "html.crickx-native-app .match-detail-page>div:first-child{margin-bottom:6px !important;}",
"html.crickx-native-app .live-scorecard-button,html.crickx-native-app .live-leaderboard-button{width:100% !important;min-width:0 !important;height:42px !important;min-height:42px !important;padding:0 12px !important;margin:0 !important;display:flex !important;align-items:center !important;justify-content:center !important;box-sizing:border-box !important;border-radius:11px !important;font-size:11px !important;font-weight:900 !important;line-height:1 !important;white-space:nowrap !important;text-align:center !important;flex:1 1 0 !important;}"
].join("");

const script = `
(function() {
  function addProfileResources() {
    try {
      if (!location.pathname.replace(/\\/+$/, '').endsWith('/profile')) return;
      if (document.getElementById('crickx-native-profile-resources')) return;

      const accountCard = Array.from(document.querySelectorAll('.card')).find((el) => {
        const text = (el.textContent || '').toLowerCase();
        return text.includes('account') && text.includes('session');
      });

      const wrap = document.createElement('section');
      wrap.id = 'crickx-native-profile-resources';
      wrap.innerHTML = \`
        <div class="crx-res-head">
          <p class="crx-res-eyebrow">CRICKX HELP &amp; RESOURCES</p>
          <h2 class="crx-res-title">Contact &amp; information</h2>
          <p class="crx-res-sub">Quick access to CrickX support, rules, policies and the official web experience.</p>
        </div>

        <div class="crx-res-section">
          <span class="crx-res-label">Contact</span>
          <div class="crx-res-list">
            <a class="crx-res-row" href="mailto:contact@crickxfantasy.com">
              <span class="crx-res-icon">✉</span>
              <span class="crx-res-copy"><span class="crx-res-name">Contact</span><span class="crx-res-value">contact@crickxfantasy.com</span></span>
              <span class="crx-res-arrow">›</span>
            </a>
            <a class="crx-res-row" href="mailto:info@crickxfantasy.com">
              <span class="crx-res-icon">✉</span>
              <span class="crx-res-copy"><span class="crx-res-name">Info</span><span class="crx-res-value">info@crickxfantasy.com</span></span>
              <span class="crx-res-arrow">›</span>
            </a>
            <a class="crx-res-row" href="mailto:support@crickxfantasy.com">
              <span class="crx-res-icon">✉</span>
              <span class="crx-res-copy"><span class="crx-res-name">Support</span><span class="crx-res-value">support@crickxfantasy.com</span></span>
              <span class="crx-res-arrow">›</span>
            </a>
          </div>
        </div>

        <div class="crx-res-section">
          <span class="crx-res-label">Information</span>
          <div class="crx-res-list">
            <a class="crx-res-row" href="/whitepaper/"><span class="crx-res-icon">📄</span><span class="crx-res-copy"><span class="crx-res-name">Whitepaper</span><span class="crx-res-value">Product and technical overview</span></span><span class="crx-res-arrow">›</span></a>
            <a class="crx-res-row" href="/profile/game-rules/"><span class="crx-res-icon">📘</span><span class="crx-res-copy"><span class="crx-res-name">Game Rules</span><span class="crx-res-value">Fantasy and prediction rules</span></span><span class="crx-res-arrow">›</span></a>
            <a class="crx-res-row" href="/profile/scoring/"><span class="crx-res-icon">⭐</span><span class="crx-res-copy"><span class="crx-res-name">Fantasy Point Calculation</span><span class="crx-res-value">Scoring tables and multipliers</span></span><span class="crx-res-arrow">›</span></a>
            <a class="crx-res-row" href="/profile/privacy/"><span class="crx-res-icon">🔒</span><span class="crx-res-copy"><span class="crx-res-name">Privacy Policy</span><span class="crx-res-value">Data and privacy information</span></span><span class="crx-res-arrow">›</span></a>
            <a class="crx-res-row" href="/profile/terms/"><span class="crx-res-icon">✓</span><span class="crx-res-copy"><span class="crx-res-name">Terms &amp; Conditions</span><span class="crx-res-value">Platform terms of use</span></span><span class="crx-res-arrow">›</span></a>
            <a class="crx-res-row" href="/profile/refund/"><span class="crx-res-icon">↩</span><span class="crx-res-copy"><span class="crx-res-name">Refund Policy</span><span class="crx-res-value">Payment and CRX refund rules</span></span><span class="crx-res-arrow">›</span></a>
            <a class="crx-res-row" href="https://crickxfantasy.site/"><span class="crx-res-icon">🌐</span><span class="crx-res-copy"><span class="crx-res-name">Web App</span><span class="crx-res-value">Open the full CrickX web experience</span></span><span class="crx-res-arrow">›</span></a>
          </div>
        </div>

        <div class="crx-res-foot">CrickX official support, documentation and service information.</div>
      \`;

      if (accountCard && accountCard.parentElement) {
        accountCard.parentElement.insertBefore(wrap, accountCard);
      } else {
        const profilePage = document.querySelector('.profile-page') || document.querySelector('.app-page');
        if (profilePage) profilePage.appendChild(wrap);
      }
    } catch (e) {}
  }

  addProfileResources();

  if (!window.__crickxProfileResourcesObserver) {
    const observer = new MutationObserver(addProfileResources);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__crickxProfileResourcesObserver = observer;
  }
})();
true;
`;

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

function AppContent() {
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const compactLayout = screenWidth < 390;
  const [loading, setLoading] = useState(true);
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
    if (activeTab === path && currentUrl.includes(path)) return;
    const target = WEB_URL.replace(/\/$/, '') + path;
    setActiveTab(path);
    setExitHintVisible(false);
    setLoading(true);
    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(target)}; true;`,
    );
  }

  function handleNavigationRequest(request: WebViewNavigation) {
    const url = request.url;
    try {
      const parsed = new URL(url);
      const protocol = parsed.protocol.toLowerCase();

      if (protocol === 'about:' || protocol === 'blob:') return true;
      if (protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return true;

      // Never render third-party web pages inside the app shell. Open only
      // explicitly allowed external destinations in the system/browser.
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
      <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
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

  const isCrickXPage = isAllowedCrickXUrl(currentUrl);
  const screenTitle = titleForTab(activeTab);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
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
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>{screenTitle}</Text>
                  <View style={styles.sectionDot} />
                </View>
              </View>
            </View>
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
              ${script}
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
              ${script}
            `}
            onNavigationStateChange={(state) => {
              const nextUrl = state.url || WEB_URL;
              setCurrentUrl(nextUrl);
              setCanGoBack(state.canGoBack);
              if (isAllowedCrickXUrl(nextUrl)) {
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
            }}
            onError={(event) => {
              setLoading(false);
              if (!initialLoadComplete.current) {
                setFailed(event.nativeEvent.description || 'Unable to connect to CrickX.');
              }
            }}
            onHttpError={(event) => {
              const status = event.nativeEvent.statusCode;
              const url = event.nativeEvent.url || '';
              if (status >= 500 && isAllowedCrickXUrl(url)) {
                setFailed(`CrickX page returned HTTP ${status}.`);
              }
            }}
            onContentProcessDidTerminate={() => {
              webViewRef.current?.reload();
            }}
            cacheEnabled
            androidLayerType="hardware"
            textZoom={100}
            scrollEnabled
            nestedScrollEnabled
            showsVerticalScrollIndicator
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
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {TABS.map((tab) => {
              const active = activeTab === tab.path;
              return (
                <Pressable
                  key={tab.path}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                  onPress={() => navigate(tab.path)}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.tabActive,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={[styles.tabIcon, active && styles.tabIconActive, compactLayout && styles.tabIconCompact]}>{tab.icon}</Text>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive, compactLayout && styles.tabLabelCompact]}>{tab.label}</Text>
                  {active && <View style={styles.tabIndicator} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080b10' },
  appShell: { flex: 1, backgroundColor: '#080b10' },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
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
    width: 38,
    height: 38,
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
    width: 34,
    height: 34,
    borderRadius: 11,
    marginRight: 11,
    backgroundColor: '#121822',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
  },
  brand: { color: '#9bf34a', fontWeight: '900', letterSpacing: 2.4, fontSize: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  sectionTitle: { color: '#f3f6fb', fontWeight: '900', fontSize: 15, marginTop: 1, letterSpacing: 0.05, flexShrink: 1 },
  sectionDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#9bf34a', marginLeft: 7, marginTop: 3 },
  webContainer: { flex: 1, backgroundColor: '#080b10' },
  web: { flex: 1, backgroundColor: '#080b10' },
  bottomBar: {
    minHeight: 70,
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 10,
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
    minWidth: 0,
    minHeight: 58,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    position: 'relative',
  },
  tabActive: { backgroundColor: 'rgba(155,243,74,.10)', borderWidth: 1, borderColor: 'rgba(155,243,74,.08)' },
  tabIndicator: { position: 'absolute', top: 4, left: '50%', marginLeft: -10, width: 20, height: 2, borderRadius: 2, backgroundColor: '#9bf34a' },
  tabIcon: { color: '#7f8999', fontSize: 18, lineHeight: 21, fontWeight: '900', includeFontPadding: false },
  tabIconCompact: { fontSize: 17, lineHeight: 20 },
  tabIconActive: { color: '#9bf34a' },
  tabLabel: { color: '#7f8999', fontSize: 10, fontWeight: '800', marginTop: 3, letterSpacing: 0.05, includeFontPadding: false },
  tabLabelCompact: { fontSize: 9, marginTop: 3 },
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
    backgroundColor: 'rgba(8,11,16,.965)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
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
