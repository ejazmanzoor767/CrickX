import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { api } from '../lib/api';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.profile().then(setProfile);
  }, []);

  if (!profile) return <View style={styles.container}><Text style={styles.sub}>Loading…</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.title}>{profile.displayName}</Text>
        <Text style={styles.sub}>{profile.state ?? '—'}, {profile.country}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', padding: 16 },
  header: { color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#14161d', padding: 14, borderRadius: 10, marginBottom: 10 },
  title: { color: 'white', fontWeight: '600' },
  sub: { color: '#8b8fa3', marginTop: 4 },
});
