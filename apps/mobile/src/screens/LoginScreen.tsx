import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    try {
      const res = await api.login(email, password);
      await AsyncStorage.setItem('accessToken', res.accessToken);
      await AsyncStorage.setItem('refreshToken', res.refreshToken);
      navigation.replace('Main');
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Log in</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8b8fa3" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8b8fa3" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.button} onPress={submit}><Text style={{ color: 'white', fontWeight: '700' }}>Log in</Text></TouchableOpacity>
      {!!error && <Text style={{ color: '#e5484d', marginTop: 8 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0d12', padding: 24, justifyContent: 'center' },
  header: { color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  input: { backgroundColor: '#1c1e26', color: 'white', padding: 12, borderRadius: 8, marginBottom: 10 },
  button: { backgroundColor: '#6e56cf', padding: 14, borderRadius: 8, alignItems: 'center' },
});
