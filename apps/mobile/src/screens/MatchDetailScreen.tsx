import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { Card, ErrorBox, Header, PrimaryButton, SecondaryButton, Stat, styles } from '../components';
import { colors } from '../theme';

export default function MatchDetailScreen({ route, navigation }: any) {
  const fixtureId = Number(route.params?.fixtureId);
  const [fixture, setFixture] = useState<any>(null);
  const [contest, setContest] = useState<any>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [match, contestResult] = await Promise.all([api.matchDetail(fixtureId), api.activeContest(fixtureId)]);
      setFixture(match?.data ?? match);
      setContest(contestResult?.data ?? contestResult);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load match.');
    }
  }

  useEffect(() => { void load(); }, [fixtureId]);
  if (!fixture) return <View style={styles.page}><Header title="Match" /><Text style={{ color: colors.muted, marginTop: 10 }}>Loading match details…</Text><ErrorBox message={error} /></View>;

  const home = fixture?.localteam?.name ?? 'Home';
  const away = fixture?.visitorteam?.name ?? 'Away';
  const status = String(fixture?.status ?? 'UPCOMING');
  const live = fixture?.live === 1 || status.toLowerCase().includes('innings');

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
      <Header title={`${home} vs ${away}`} subtitle={status} onBack={() => navigation.goBack()} />
      <ErrorBox message={error} />

      <Card style={{ padding: 22, backgroundColor: live ? '#101e14' : colors.surface }}>
        <Text style={{ color: live ? colors.green : colors.muted, fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>{live ? 'LIVE MATCH' : 'MATCH CENTER'}</Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 10 }}>{home}</Text>
        <Text style={{ color: colors.muted, marginVertical: 4, fontWeight: '700' }}>VS</Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900' }}>{away}</Text>
        <Text style={{ color: colors.muted, marginTop: 12 }}>{fixture?.starting_at ? new Date(fixture.starting_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</Text>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 13 }}>Contest</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="ENTRY" value="FREE" note="Subscribers" />
          <Stat label="PARTICIPANTS" value={String(contest?.filledSpots ?? 0)} note="Unlimited" />
          <Stat label="PRIZE POOL" value={`${Number(contest?.prizePoolTotal ?? 0)} CRX`} note="10 CRX / participant" />
        </View>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton title="Open Contest" onPress={() => navigation.navigate('Contest', { fixtureId })} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><SecondaryButton title="Leaderboard" onPress={() => navigation.navigate('Leaderboard', { fixtureId })} /></View>
        <View style={{ flex: 1 }}><SecondaryButton title="My Team" onPress={() => navigation.navigate('Fantasy', { fixtureId })} /></View>
      </View>
    </ScrollView>
  );
}
