import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, Text } from 'react-native';
import { api, WEB_URL } from '../lib/api';
import { Card, Header, PrimaryButton, SecondaryButton, Stat, styles } from '../components';
import { colors } from '../theme';

export default function WalletScreen() {
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => { api.subscription().then((r: any) => setSubscription(r?.data ?? r)).catch(() => setSubscription(null)); }, []);

  const active = Boolean(subscription?.active);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
      <Header title="Wallet" subtitle="Manage CRX and your weekly CrickX access." />
      <Card>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>CRX WALLET</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 6 }}>Your external wallet</Text>
        <Text style={{ color: colors.muted, lineHeight: 19, marginTop: 6 }}>CRX stays in your external Polygon wallet. Use the full CrickX wallet screen for balance, transfers and MetaMask actions.</Text>
        <View style={{ marginTop: 14 }}><PrimaryButton title="Open CRX Wallet" onPress={() => Linking.openURL(`${WEB_URL}/wallet`)} /></View>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 12 }}>Weekly access</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="STATUS" value={active ? 'ACTIVE' : 'INACTIVE'} note={active ? 'Contest access' : 'Subscribe to join'} />
          <Stat label="PRICE" value="50 PKR" note="7 days" />
        </View>
        <View style={{ marginTop: 14 }}>
          <SecondaryButton title={active ? 'View Subscription' : 'Subscribe on CrickX'} onPress={() => Linking.openURL(`${WEB_URL}/subscription`)} />
        </View>
      </Card>
    </ScrollView>
  );
}
