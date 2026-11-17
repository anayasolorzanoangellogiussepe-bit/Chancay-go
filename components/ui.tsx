import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

export const colors = { primary: '#0B6E4F', dark: '#08392A', danger: '#C62828', bg: '#F5F7F6', text: '#1B1B1B', muted: '#667' };

export function Button({ title, onPress, loading, variant = 'primary', disabled }: {
  title: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'danger' | 'ghost'; disabled?: boolean;
}) {
  const bg = variant === 'danger' ? colors.danger : variant === 'ghost' ? 'transparent' : colors.primary;
  const fg = variant === 'ghost' ? colors.primary : '#fff';
  return (
    <Pressable onPress={onPress} disabled={loading || disabled}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, variant === 'ghost' && { borderWidth: 1, borderColor: colors.primary }]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#99a" style={s.input} {...props} />
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

const s = StyleSheet.create({
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginVertical: 6 },
  btnText: { fontWeight: '700', fontSize: 16 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#d8dedb', padding: 12, fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginVertical: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
});
