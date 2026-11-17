import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Field, colors } from '../../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('No se pudo ingresar', error.message);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 90, backgroundColor: colors.bg, flexGrow: 1 }}>
      <Text style={{ fontSize: 34, fontWeight: '900', color: colors.primary }}>ChancayGo</Text>
      <Text style={{ color: colors.muted, marginBottom: 28 }}>Viajes seguros en Chancay</Text>
      <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Ingresar" onPress={submit} loading={busy} />
      <Link href="/(auth)/register" style={{ textAlign: 'center', marginTop: 18, color: colors.primary, fontWeight: '700' }}>
        Crear cuenta nueva
      </Link>
      <Link href="/legal" style={{ textAlign: 'center', marginTop: 14, color: colors.muted }}>Términos y política de privacidad</Link>
    </ScrollView>
  );
}
