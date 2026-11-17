import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { LEGAL_SECTIONS } from '../lib/legal';
import { Button, colors } from '../components/ui';

export default function Legal() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 60, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 12 }}>Términos y política de privacidad</Text>
      {LEGAL_SECTIONS.map((s) => (
        <Text key={s.title} style={{ marginBottom: 14, lineHeight: 21 }}>
          <Text style={{ fontWeight: '800' }}>{s.title}{'\n'}</Text>
          {s.body}
        </Text>
      ))}
      <Button title="Volver" onPress={() => router.back()} />
    </ScrollView>
  );
}
