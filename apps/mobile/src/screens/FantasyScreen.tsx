import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../lib/api';

export default function FantasyScreen() {
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    api.myFantasyTeams().then((res: any) => setTeams(res ?? []));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Fantasy</Text>
      <FlatList
        data={teams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.sub}>{item.players?.length ?? 0} players</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.sub}>No fantasy teams yet.</Text>}
      />
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
