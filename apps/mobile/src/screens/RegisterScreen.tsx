import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { api, setSession } from '../lib/api';
import { Card, ErrorBox, PrimaryButton, SecondaryButton } from '../components';
import { colors } from '../theme';

export default function RegisterScreen({ navigation }: any) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!displayName.trim()) return setError('Enter your display name.');
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true); setError('');
    try {
      const result = await api.register(email.trim(), password, displayName.trim(), phone.trim() || undefined);
      await setSession(result.accessToken, result.refreshToken);
      navigation.replace('Main');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.green, fontWeight: '900', letterSpacing: 3, fontSize: 12 }}>CRICKX</Text>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 34, marginTop: 7 }}>Create account</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 }}>Join CrickX, build your XI and follow live fantasy cricket.</Text>

        <Card>
          <TextInput placeholder="Display name" placeholderTextColor={colors.muted} value={displayName} onChangeText={setDisplayName} style={inputStyle} />
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={inputStyle} />
          <TextInput keyboardType="phone-pad" placeholder="Phone (optional)" placeholderTextColor={colors.muted} value={phone} onChangeText={setPhone} style={inputStyle} />
          <TextInput secureTextEntry placeholder="Password (8+ characters)" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} style={inputStyle} />
          <PrimaryButton title={busy ? 'Creating account…' : 'Create account'} onPress={submit} disabled={busy} />
          <View style={{ height: 10 }} />
          <SecondaryButton title="Back to sign in" onPress={() => navigation.goBack()} />
        </Card>
        <ErrorBox message={error} />
      </ScrollView>
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
