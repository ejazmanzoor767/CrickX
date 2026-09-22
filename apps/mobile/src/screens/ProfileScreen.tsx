import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { api } from '../lib/api';

export default function ProfileScreen({ onSignOut }: { navigation?: any; onSignOut?: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.profile()
      .then(setProfile)
      .catch((e: any) => setError(e instanceof Error ? e.message : 'Unable to load profile.'));
  }, []);

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Profile</Text>
        <Text style={styles.sub}>{error || 'Loading…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.title}>{profile.displayName ?? 'CrickX Player'}</Text>
        <Text style={styles.sub}>{profile.email ?? '—'}</Text>
        <Text style={styles.sub}>{profile.state ?? '—'}, {profile.country ?? '—'}</Text>
      </View>

      {!!onSignOut && (
        <TouchableOpacity onPress={onSignOut} style={styles.button}>
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', padding: 16 },
  header: { color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#14161d', padding: 14, borderRadius: 10, marginBottom: 14 },
  title: { color: 'white', fontWeight: '700', fontSize: 18 },
  sub: { color: '#8b8fa3', marginTop: 5 },
  button: { backgroundColor: '#9bf34a', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#12220a', fontWeight: '900' },
});
