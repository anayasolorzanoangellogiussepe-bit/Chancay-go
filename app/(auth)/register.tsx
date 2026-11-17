import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button, Field, colors } from '../../components/ui';

export default function Register() {
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [f, setF] = useState({ full_name: '', dni: '', phone: '', email: '', password: '', emergency_name: '', emergency_phone: '' });
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!/^\d{8}$/.test(f.dni)) return Alert.alert('DNI inválido', 'Debe tener 8 dígitos.');
    if (!/^9\d{8}$/.test(f.phone)) return Alert.alert('Celular inválido', 'Ingresa 9 dígitos que empiecen con 9.');
    if (f.full_name.trim().length < 5) return Alert.alert('Nombre', 'Ingresa tus nombres y apellidos completos.');
    if (f.password.length < 8) return Alert.alert('Contraseña', 'Mínimo 8 caracteres.');
    if (!f.emergency_phone) return Alert.alert('Contacto de emergencia', 'Es obligatorio para viajar de forma segura.');
    if (!accepted) return Alert.alert('Términos', 'Debes aceptar los términos y la política de privacidad.');
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { role, full_name: f.full_name.trim(), dni: f.dni, phone: f.phone,
                         emergency_name: f.emergency_name, emergency_phone: f.emergency_phone } },
    });
    setBusy(false);
    if (error) Alert.alert('No se pudo registrar', error.message.includes('profiles_dni_key') ? 'Ese DNI ya está registrado.' : error.message);
    else if (role === 'driver') Alert.alert('Cuenta creada', 'Ahora completa los datos de tu vehículo y documentos para que te validemos.');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 26, fontWeight: '800', marginBottom: 14 }}>Crear cuenta</Text>
      <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
        {(['passenger', 'driver'] as const).map((r) => (
          <Pressable key={r} onPress={() => setRole(r)} style={{
            flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
            backgroundColor: role === r ? colors.primary : '#fff', borderWidth: 1, borderColor: colors.primary }}>
            <Text style={{ color: role === r ? '#fff' : colors.primary, fontWeight: '700' }}>{r === 'passenger' ? 'Soy pasajero' : 'Soy chofer'}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Nombres y apellidos (como en tu DNI)" value={f.full_name} onChangeText={set('full_name')} />
      <Field label="DNI" value={f.dni} onChangeText={set('dni')} keyboardType="number-pad" maxLength={8} />
      <Field label="Celular" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={9} />
      <Field label="Correo" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Contraseña" value={f.password} onChangeText={set('password')} secureTextEntry />
      <Text style={{ fontWeight: '700', marginVertical: 6 }}>Contacto de emergencia</Text>
      <Field label="Nombre" value={f.emergency_name} onChangeText={set('emergency_name')} />
      <Field label="Celular" value={f.emergency_phone} onChangeText={set('emergency_phone')} keyboardType="phone-pad" maxLength={9} />
      <Text onPress={() => setAccepted(!accepted)} style={{ marginVertical: 8 }}>
        {accepted ? '☑' : '☐'} Acepto los términos y la política de privacidad
      </Text>
      <Link href="/legal" style={{ color: colors.primary, marginBottom: 8 }}>Leer términos y privacidad</Link>
      <Button title="Registrarme" onPress={submit} loading={busy} />
    </ScrollView>
  );
}
