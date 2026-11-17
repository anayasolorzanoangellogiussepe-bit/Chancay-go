import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button, Card, colors } from '../../components/ui';
import { DeleteAccountButton } from '../../components/DeleteAccount';

interface PendingDriver {
  id: string; license_no: string; plate: string; vehicle_model: string; vehicle_color: string; soat_expiry: string;
  photo_url: string | null; license_url: string | null; soat_url: string | null;
  profiles: { full_name: string; dni: string; phone: string };
}
interface Sos { id: string; lat: number | null; lng: number | null; created_at: string; profiles: { full_name: string; phone: string } }
interface Rep { id: string; reason: string; details: string | null; created_at: string }

export default function AdminHome() {
  const { signOut } = useAuth();
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [sos, setSos] = useState<Sos[]>([]);
  const [reports, setReports] = useState<Rep[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [d, s, r] = await Promise.all([
      supabase.from('drivers').select('*, profiles(full_name, dni, phone)').eq('status', 'pending'),
      supabase.from('sos_alerts').select('*, profiles(full_name, phone)').eq('resolved', false).order('created_at', { ascending: false }),
      supabase.from('reports').select('*').eq('resolved', false).order('created_at', { ascending: false }),
    ]);
    const list = (d.data ?? []) as unknown as PendingDriver[];
    setDrivers(list); setSos((s.data ?? []) as unknown as Sos[]); setReports((r.data ?? []) as Rep[]);
    const paths = list.flatMap((x) => [x.photo_url, x.license_url, x.soat_url]).filter(Boolean) as string[];
    if (paths.length) {
      const { data } = await supabase.storage.from('driver-docs').createSignedUrls(paths, 600);
      setUrls(Object.fromEntries((data ?? []).map((u): [string, string] => [u.path ?? '', u.signedUrl ?? ''])));
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-sos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sos_alerts' }, () => {
        Alert.alert('🆘 Nueva alerta SOS'); load();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    const patch = status === 'rejected' ? { status, rejection_reason: 'Documentos ilegibles o inválidos. Vuelve a registrarte.' } : { status };
    const { error } = await supabase.from('drivers').update(patch).eq('id', id);
    if (error) Alert.alert('Error', error.message); else load();
  };
  const resolve = async (table: 'sos_alerts' | 'reports', id: string) => {
    await supabase.from(table).update({ resolved: true }).eq('id', id); load();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>Panel de administración</Text>

      <Text style={{ fontWeight: '800', marginTop: 16, color: colors.danger }}>🆘 Alertas SOS activas ({sos.length})</Text>
      {sos.map((a) => (
        <Card key={a.id}>
          <Text style={{ fontWeight: '700' }}>{a.profiles.full_name} · {a.profiles.phone}</Text>
          <Text>{new Date(a.created_at).toLocaleString('es-PE')}</Text>
          {a.lat != null && <Text>Ubicación: {a.lat.toFixed(5)}, {a.lng?.toFixed(5)}</Text>}
          <Button title="Marcar atendida" onPress={() => resolve('sos_alerts', a.id)} />
        </Card>
      ))}

      <Text style={{ fontWeight: '800', marginTop: 16 }}>Choferes por validar ({drivers.length})</Text>
      {drivers.map((d) => (
        <Card key={d.id}>
          <Text style={{ fontWeight: '700' }}>{d.profiles.full_name} · DNI {d.profiles.dni}</Text>
          <Text>{d.vehicle_model} {d.vehicle_color} · Placa {d.plate}</Text>
          <Text>Licencia {d.license_no} · SOAT vence {d.soat_expiry}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
            {[d.photo_url, d.license_url, d.soat_url].map((p, i) => p && urls[p]
              ? <Image key={i} source={{ uri: urls[p] }} style={{ flex: 1, height: 110, borderRadius: 8 }} resizeMode="cover" /> : null)}
          </View>
          <Button title="Aprobar" onPress={() => decide(d.id, 'approved')} />
          <Button variant="danger" title="Rechazar" onPress={() => decide(d.id, 'rejected')} />
        </Card>
      ))}

      <Text style={{ fontWeight: '800', marginTop: 16 }}>Reportes de usuarios ({reports.length})</Text>
      {reports.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700' }}>{r.reason}</Text>
          {r.details && <Text>{r.details}</Text>}
          <Button variant="ghost" title="Marcar resuelto" onPress={() => resolve('reports', r.id)} />
        </Card>
      ))}
      <Button variant="ghost" title="Cerrar sesión" onPress={signOut} />
      <DeleteAccountButton />
    </ScrollView>
  );
}
