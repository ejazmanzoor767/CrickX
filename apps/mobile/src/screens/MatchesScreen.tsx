import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../lib/api';
import { colors } from '../theme';
import { Card, EmptyState, ErrorBox, Header, PrimaryButton, Stat, styles } from '../components';

const normalize = (value: any) => Array.isArray(value) ? value : value?.data ?? [];

function MatchCard({ item, navigation }: any) {
  const live = Boolean(item?.live) && !String(item?.status ?? '').toLowerCase().includes('finish');
  const start = item?.starting_at ? new Date(item.starting_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : 'Start time unavailable';
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('MatchDetail', { fixtureId: Number(item.id) })}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: live ? colors.green : colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{live ? 'LIVE' : String(item?.status ?? 'UPCOMING').toUpperCase()}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{item?.type ?? 'Cricket'}</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 9 }}>{item?.localteam?.name ?? 'TBD'}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginVertical: 2 }}>vs</Text>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>{item?.visitorteam?.name ?? 'TBD'}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>{start}</Text>
        <Text style={{ color: colors.green, fontSize: 12, fontWeight: '800', marginTop: 8 }}>Open match →</Text>
      </Card>
    </TouchableOpacity>
  );
}

export default function MatchesScreen({ navigation }: any) {
  const [tab, setTab] = useState<'upcoming' | 'live' | 'completed'>('upcoming');
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) setBusy(true); else setRefreshing(true);
    setError('');
    try {
      const result = tab === 'live' ? await api.liveMatches() : tab === 'completed' ? await api.completedMatches() : await api.upcomingMatches();
      setItems(normalize(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load matches.');
    } finally {
      setBusy(false); setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (tab === 'live') void load(false); }, 30000);
    return () => clearInterval(timer);
  }, [tab, load]);

  if (busy) return <View style={styles.page}><Header title="Matches" subtitle="Live cricket from Sportmonks via CrickX." /></View>;

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={styles.scroll}
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={colors.green} />}
        ListHeaderComponent={
          <>
            <Header title="Matches" subtitle="Upcoming, live and completed matches in one place." />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {(['upcoming', 'live', 'completed'] as const).map((name) => (
                <TouchableOpacity key={name} onPress={() => setTab(name)} style={{ flex: 1, backgroundColor: tab === name ? colors.green : colors.surface, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: tab === name ? colors.green : colors.border }}>
                  <Text style={{ color: tab === name ? colors.greenDark : colors.text, fontWeight: '900', fontSize: 12 }}>{name === 'upcoming' ? 'Upcoming' : name === 'live' ? 'Live' : 'Completed'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ErrorBox message={error} />
          </>
        }
        renderItem={({ item }) => <MatchCard item={item} navigation={navigation} />}
        ListEmptyComponent={<EmptyState title="No matches found" body="Try another match filter or pull down to refresh." />}
      />
    </View>
  );
}
