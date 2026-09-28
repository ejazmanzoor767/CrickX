import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from './theme';

export function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {!!onBack && (
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      )}
      <View style={styles.headerCopy}>
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
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.82}
      style={[styles.primaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.82}
      style={[styles.secondaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return !!message ? (
    <View style={styles.errorBox}>
      <View style={styles.errorDot} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  ) : null;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✦</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!body && <Text style={styles.emptyBody}>{body}</Text>}
    </Card>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={styles.loadingText}>Loading CrickX…</Text>
    </View>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {!!note && <Text style={styles.statNote}>{note}</Text>}
    </View>
  );
}

export const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  scroll: { paddingBottom: 42 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 13,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backText: { color: colors.text, fontSize: 28, lineHeight: 30, fontWeight: '700' },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 3, letterSpacing: -0.3 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: colors.green,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  primaryText: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  secondaryButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: 'rgba(255,107,107,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,.20)',
    padding: 12,
    borderRadius: 13,
    marginBottom: 12,
  },
  errorDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: colors.red,
    marginTop: 5,
  },
  errorText: { flex: 1, color: '#ffb6b6', fontSize: 13, lineHeight: 18 },
  emptyCard: { alignItems: 'center', paddingVertical: 28, marginTop: 4 },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyIconText: { color: colors.green, fontSize: 20, fontWeight: '900' },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 13, marginTop: 7, textAlign: 'center', lineHeight: 19 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: { color: colors.muted, marginTop: 12, fontSize: 13 },
  stat: { flex: 1, minWidth: 0, paddingRight: 8 },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statValue: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  statNote: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
