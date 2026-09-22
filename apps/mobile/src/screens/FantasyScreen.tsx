import React, { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, WEB_URL } from '../lib/api';
import { Card, EmptyState, Header, PrimaryButton, SecondaryButton, styles } from '../components';
import { colors } from '../theme';

export default function FantasyScreen({ route }: any) {
  const fixtureId = Number(route?.params?.fixtureId);
  const [teams, setTeams] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result: any = await api.myFantasyTeams();
    const list = Array.isArray(result) ? result : result?.data ?? [];
    setTeams(fixtureId > 0 ? list.filter((t: any) => Number(t?.sportmonksFixtureId) === fixtureId) : list);
  }, [fixtureId]);

  useEffect(() => { void load(); }, [load]);

  const buildUrl = fixtureId > 0 ? `${WEB_URL}/fantasy?fixtureId=${fixtureId}` : `${WEB_URL}/fantasy-home`;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }} tintColor={colors.green} />}>
      <Header title="Fantasy" subtitle="Manage your saved XIs and build teams quickly." />
      <Card style={{ backgroundColor: '#0f1911' }}>
        <Text style={{ color: colors.green, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>BUILD YOUR XI</Text>
        <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 7 }}>Create your team</Text>
        <Text style={{ color: colors.muted, lineHeight: 19, marginTop: 5, marginBottom: 13 }}>Pick 11 players, captain and vice-captain. The full team-builder remains the same CrickX flow you use on the web.</Text>
        <PrimaryButton title="Open Team Builder" onPress={() => Linking.openURL(buildUrl)} />
      </Card>

      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 9 }}>Saved teams</Text>
      {teams.length ? teams.map((team: any) => (
        <Card key={team.id}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{team.name ?? 'My CrickX XI'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>{team.players?.length ?? 0}/11 players</Text>
          <View style={{ marginTop: 12 }}><SecondaryButton title="Edit on CrickX" onPress={() => Linking.openURL(buildUrl)} /></View>
        </Card>
      )) : <EmptyState title="No saved fantasy teams" body="Build your first XI to enter upcoming contests." />}
    </ScrollView>
  );
}
