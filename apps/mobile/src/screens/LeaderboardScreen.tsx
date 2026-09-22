import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { Card, EmptyState, ErrorBox, Header, styles } from '../components';
import { colors } from '../theme';

export default function LeaderboardScreen({ route }: any) {
  const fixtureId = Number(route.params?.fixtureId);
  const [rows, setRows] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result: any = await api.leaderboardFixture(fixtureId, 100);
      const list = Array.isArray(result) ? result : result?.data ?? [];
      setRows([...list].map((row: any, index: number) => ({ ...row, rank: Number(row?.rank ?? index + 1), points: Number(row?.totalPoints ?? row?.points ?? 0), displayName: row?.displayName ?? row?.name ?? 'CrickX Player' })).sort((a: any, b: any) => a.rank - b.rank));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load leaderboard.');
    }
  }, [fixtureId]);

  useEffect(() => { void load(); const timer = setInterval(() => void load(), 30000); return () => clearInterval(timer); }, [load]);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.green} />}
    >
      <Header title="Leaderboard" subtitle="Live standings update automatically during matches." onBack={() => navigation.goBack()} />
      <ErrorBox message={error} />
      {rows.length ? <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <View key={String(row.id ?? row.userId ?? index)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
            <Text style={{ width: 38, color: row.rank <= 3 ? colors.gold : colors.muted, fontSize: 17, fontWeight: '900' }}>{row.rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>{row.displayName}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>Fantasy entry</Text>
            </View>
            <Text style={{ color: colors.green, fontSize: 16, fontWeight: '900' }}>{Number.isInteger(row.points) ? row.points : row.points.toFixed(1)}</Text>
          </View>
        ))}
      </Card> : <EmptyState title="No leaderboard entries yet" body="Standings appear as fantasy scores are recorded." />}
    </ScrollView>
  );
}
