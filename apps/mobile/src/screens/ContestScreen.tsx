import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api, WEB_URL } from '../lib/api';
import { Card, ErrorBox, Header, PrimaryButton, SecondaryButton, Stat, styles } from '../components';
import { colors } from '../theme';

export default function ContestScreen({ route, navigation }: any) {
  const fixtureId = Number(route.params?.fixtureId);
  const [contest, setContest] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [contestResult, teamResult, subscriptionResult] = await Promise.all([api.activeContest(fixtureId), api.myFantasyTeams(), api.subscription()]);
      const c = contestResult?.data ?? contestResult;
      const list = Array.isArray(teamResult) ? teamResult : teamResult?.data ?? [];
      setContest(c);
      setTeams(list.filter((item: any) => Number(item?.sportmonksFixtureId) === fixtureId));
      setSubscription(subscriptionResult?.data ?? subscriptionResult);
      if (!selectedTeam && list.find((item: any) => Number(item?.sportmonksFixtureId) === fixtureId)?.id) {
        setSelectedTeam(list.find((item: any) => Number(item?.sportmonksFixtureId) === fixtureId).id);
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load contest.');
    }
  }

  useEffect(() => { void load(); }, [fixtureId]);

  const activeSubscription = Boolean(subscription?.active);
  const open = contest?.entriesOpen !== false && contest?.status === 'UPCOMING';
  const pool = Number(contest?.prizePoolTotal ?? 0);
  const selectedName = useMemo(() => teams.find((t) => t.id === selectedTeam)?.name ?? 'My CrickX XI', [teams, selectedTeam]);

  async function openJoin() {
    if (!activeSubscription) return navigation.navigate('Profile');
    if (!selectedTeam) return Alert.alert('Select a team', 'Build and save an XI for this match first.');
    const url = `${WEB_URL}/contest?fixtureId=${fixtureId}&teamId=${encodeURIComponent(selectedTeam)}`;
    try { await Linking.openURL(url); } catch { Alert.alert('Unable to open CrickX', 'Open the CrickX website in your mobile browser to finish the wallet confirmation.'); }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
      <Header title="Contest" subtitle="Free entry for active weekly subscribers." />
      <ErrorBox message={error} />

      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="PRIZE POOL" value={`${pool} CRX`} note="10 CRX per participant" />
          <Stat label="PLAYERS" value={String(contest?.filledSpots ?? 0)} note="Unlimited" />
          <Stat label="ENTRY" value="FREE" note="0 CRX charged" />
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Your access</Text>
        <Text style={{ color: colors.muted, lineHeight: 19, marginTop: 6 }}>{activeSubscription ? 'Subscription active. You can join the free contest.' : 'A 50 PKR weekly subscription is required to join contests.'}</Text>
        {!!subscription?.expiresAt && activeSubscription && <Text style={{ color: colors.green, fontSize: 12, marginTop: 8, fontWeight: '800' }}>Active until {new Date(subscription.expiresAt).toLocaleString('en-PK')}</Text>}
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Fantasy team</Text>
        {teams.length ? (
          <View style={{ marginTop: 10 }}>
            {teams.map((team: any) => {
              const selected = team.id === selectedTeam;
              return <TouchableOpacity key={team.id} onPress={() => setSelectedTeam(team.id)} style={{ padding: 13, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.green : colors.border, backgroundColor: selected ? 'rgba(155,243,74,.08)' : colors.surface2, marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>{team.name ?? 'My CrickX XI'}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{team.players?.length ?? 0}/11 players · {selected ? 'Selected' : 'Tap to select'}</Text>
              </TouchableOpacity>;
            })}
            <PrimaryButton title={open ? `Join ${selectedName}` : 'Entries Closed'} onPress={openJoin} disabled={!open} />
          </View>
        ) : (
          <>
            <Text style={{ color: colors.muted, lineHeight: 19, marginTop: 6 }}>You need a saved fantasy team for this match.</Text>
            <SecondaryButton title="Build Team on CrickX" onPress={() => Linking.openURL(`${WEB_URL}/fantasy?fixtureId=${fixtureId}`)} />
          </>
        )}
      </Card>

      <SecondaryButton title="Open Leaderboard" onPress={() => navigation.navigate('Leaderboard', { fixtureId })} />
    </ScrollView>
  );
}
