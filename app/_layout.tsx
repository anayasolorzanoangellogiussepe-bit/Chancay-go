import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth';
import '../lib/backgroundLocation'; // registra la tarea de ubicación en segundo plano

function Guard() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const group = segments[0] as string | undefined;
    if (group === 'legal') return;
    if (!session) {
      if (group !== '(auth)') router.replace('/(auth)/login');
      return;
    }
    if (!profile) return;
    const target = profile.role === 'admin' ? '(admin)' : profile.role === 'driver' ? '(driver)' : '(passenger)';
    if (group !== target) router.replace(`/${target}/home` as never);
  }, [session, profile, loading, segments, router]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Guard />
    </AuthProvider>
  );
}
