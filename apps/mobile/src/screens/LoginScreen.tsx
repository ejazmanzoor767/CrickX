import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, setSession } from '../lib/api';
import { Card, ErrorBox, PrimaryButton } from '../components';
import { colors } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true); setError('');
    try {
      const result = await api.login(email.trim(), password);
      await setSession(result.accessToken, result.refreshToken);
      navigation.replace('Main');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to log in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.green, fontWeight: '900', letterSpacing: 3, fontSize: 12 }}>CRICKX</Text>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 36, marginTop: 7 }}>Fantasy Cricket</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 }}>Build your XI, follow live cricket, join contests and track your CRX rewards.</Text>

        <Card>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 13 }}>Welcome back</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={inputStyle} />
          <TextInput secureTextEntry placeholder="Password" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} style={inputStyle} />
          <PrimaryButton title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} />
          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.green, fontSize: 12, fontWeight: '800' }}>Create a new CrickX account</Text>
          </TouchableOpacity>
        </Card>
        <ErrorBox message={error} />
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: '#0b1018',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,.08)',
  color: colors.text,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 13,
  marginBottom: 10,
};
