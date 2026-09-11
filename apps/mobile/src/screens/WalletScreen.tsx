import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://crickx-3d806.web.app';

export default function WalletScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>CRX Wallet</Text>
      <View style={styles.card}>
        <Text style={styles.title}>Web3 wallet</Text>
        <Text style={styles.sub}>CRX is held in your external wallet on Polygon. The old server wallet is no longer used for user balances or contest entry.</Text>
        <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(`${WEB_URL}/wallet`)}>
          <Text style={styles.buttonText}>Open CRX Wallet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', padding: 16 },
  header: { color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#14161d', padding: 18, borderRadius: 12 },
  title: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sub: { color: '#a7adbf', lineHeight: 20, marginBottom: 16 },
  button: { backgroundColor: '#9bff47', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#071006', fontWeight: '800' },
});
