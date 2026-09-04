import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../lib/api';

export default function MatchesScreen({ navigation }: any) {
  const [fixtures, setFixtures] = useState<any[]>([]);

  useEffect(() => {
    api.matches().then((res: any) => setFixtures(res.data ?? []));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Matches</Text>
      <FlatList
        data={fixtures}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('MatchDetail', { fixtureId: item.id })}>
            <Text style={styles.title}>{item.localteam?.name ?? 'TBD'} vs {item.visitorteam?.name ?? 'TBD'}</Text>
            <Text style={styles.sub}>{item.type} · {item.status}</Text>
          </TouchableOpacity>
        )}
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
