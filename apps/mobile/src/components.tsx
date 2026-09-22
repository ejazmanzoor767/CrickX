import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from './theme';

export function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {!!onBack && <TouchableOpacity onPress={onBack} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ color: colors.text, fontSize: 28, lineHeight: 30 }}>‹</Text></TouchableOpacity>}
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>CRICKX FANTASY</Text>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && { opacity: 0.45 }]}>
      <Text style={styles.primaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.secondaryButton, disabled && { opacity: 0.45 }]}>
      <Text style={styles.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return !!message ? <View style={styles.errorBox}><Text style={styles.errorText}>{message}</Text></View> : null;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
    <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
    {!!body && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 7, textAlign: 'center', lineHeight: 19 }}>{body}</Text>}
  </Card>;
}

export function Loading() {
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.green} /></View>;
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    {!!note && <Text style={styles.statNote}>{note}</Text>}
  </View>;
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 3 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.lg, marginBottom: spacing.md },
  primaryButton: { backgroundColor: colors.green, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  secondaryButton: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  errorBox: { backgroundColor: 'rgba(255,107,107,.10)', borderWidth: 1, borderColor: 'rgba(255,107,107,.25)', padding: 12, borderRadius: 12, marginBottom: 12 },
  errorText: { color: '#ffb6b6', fontSize: 13, lineHeight: 18 },
  stat: { flex: 1, minWidth: 0, paddingRight: 8 },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  statNote: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
