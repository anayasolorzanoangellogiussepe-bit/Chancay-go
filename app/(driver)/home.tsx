import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { haversineKm } from '../../lib/geo';
import { startDriverTracking, stopDriverTracking } from '../../lib/backgroundLocation';
import type { Driver, Profile, Trip, TripStatus } from '../../lib/types';
import { Button, Card, Field, colors } from '../../components/ui';
import { RatingModal, SosButton } from '../../components/TripSafety';
import { DeleteAccountButton } from '../../components/DeleteAccount';

const RADIUS_KM = 6;

/* ---------- Registro de vehículo y documentos ---------- */
function Onboarding({ me, onDone }: { me: Profile; onDone: () => void }) {
  const [f, setF] = useState({ license_no: '', plate: '', vehicle_model: '', vehicle_color: '', soat_expiry: '', municipal_permit: '' });
  const [docs, setDocs] = useState<{ photo?: string; license?: string; soat?: string }>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const pick = async (k: 'photo' | 'license' | 'soat') => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled) setDocs((p) => ({ ...p, [k]: r.assets[0].uri }));
  };

  const upload = async (key: string, uri: string) => {
    const buf = await (await fetch(uri)).arrayBuffer();
    const path = `${me.id}/${key}.jpg`;
    const { error } = await supabase.storage.from('driver-docs').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.soat_expiry)) return Alert.alert('SOAT', 'Fecha de vencimiento con formato AAAA-MM-DD.');
    if (new Date(f.soat_expiry) < new Date()) return Alert.alert('SOAT vencido', 'Renueva tu SOAT para registrarte.');
    if (!f.license_no || !f.municipal_permit || !f.plate || !f.vehicle_model || !f.vehicle_color) return Alert.alert('Faltan datos', 'Completa todos los campos.');
    if (!docs.photo || !docs.license || !docs.soat) return Alert.alert('Documentos', 'Toma las 3 fotos: tu rostro, licencia y SOAT.');
    setBusy(true);
    try {
      const [photo_url, license_url, soat_url] = await Promise.all([
        upload('rostro', docs.photo), upload('licencia', docs.license), upload('soat', docs.soat)]);
      const { error } = await supabase.from('drivers').insert({
        id: me.id, ...f, plate: f.plate.toUpperCase().replace(/\s/g, ''), photo_url, license_url, soat_url });
      if (error) throw error;
      onDone();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo enviar');
    }
    setBusy(false);
  };

  const tick = (v?: string) => (v ? '✅' : '📷');
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: '800', marginBottom: 4 }}>Valida tu cuenta de chofer</Text>
      <Text style={{ color: colors.muted, marginBottom: 14 }}>Revisamos tus datos antes de activarte, por la seguridad de todos.</Text>
      <Field label="N.º de licencia de conducir" value={f.license_no} onChangeText={set('license_no')} autoCapitalize="characters" />
<Field label="N.º de autorización municipal (taxi/mototaxi)" value={f.municipal_permit} onChangeText={set('municipal_permit')} autoCapitalize="characters" />
      <Field label="Placa" value={f.plate} onChangeText={set('plate')} autoCapitalize="characters" />
      <Field label="Marca y modelo" value={f.vehicle_model} onChangeText={set('vehicle_model')} />
      <Field label="Color" value={f.vehicle_color} onChangeText={set('vehicle_color')} />
      <Field label="Vencimiento del SOAT (AAAA-MM-DD)" value={f.soat_expiry} onChangeText={set('soat_expiry')} placeholder="2027-03-31" />
      <Button variant="ghost" title={`${tick(docs.photo)} Foto de tu rostro`} onPress={() => pick('photo')} />
      <Button variant="ghost" title={`${tick(docs.license)} Foto de tu licencia`} onPress={() => pick('license')} />
      <Button variant="ghost" title={`${tick(docs.soat)} Foto del SOAT`} onPress={() => pick('soat')} />
      <Button title="Enviar para validación" onPress={submit} loading={busy} />
    </ScrollView>
  );
}

/* ---------- Panel del chofer aprobado ---------- */
function Dashboard({ me, driver, refresh }: { me: Profile; driver: Driver; refresh: () => Promise<void> }) {
  const { signOut } = useAuth();
  const [online, setOnline] = useState(driver.is_online);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState<Trip[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [passenger, setPassenger] = useState<Profile | null>(null);
  const [rate, setRate] = useState<Trip | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);

  // Mientras está en línea: segundo plano (publica en la base de datos) + primer plano (solo para la pantalla)
  useEffect(() => {
    if (!online) { sub.current?.remove(); sub.current = null; stopDriverTracking(); return; }
    let cancelled = false;
    (async () => {
      const r = await startDriverTracking();
      if (cancelled) return;
      if (!r.ok) { setOnline(false); supabase.from('drivers').update({ is_online: false }).eq('id', me.id).then(() => {}); return Alert.alert('Ubicación requerida', 'Activa el permiso de ubicación para conectarte.'); }
      if (!r.background) {
        Alert.alert('Solo con la app abierta', 'Sin el permiso de segundo plano, tu ubicación se comparte únicamente con la app abierta en pantalla.');
      }
      sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(c);
        // Sin segundo plano, la app abierta es la única fuente de ubicación
        if (!r.background) supabase.from('drivers').update({ lat: c.lat, lng: c.lng, location_at: new Date().toISOString() }).eq('id', me.id).then(() => {});
      });
    })();
    return () => { cancelled = true; sub.current?.remove(); };
  }, [online, me.id]);

  const toggle = async (v: boolean) => {
    setOnline(v);
    await supabase.from('drivers').update({ is_online: v }).eq('id', me.id);
  };

  const loadTrips = useCallback(async () => {
    const { data: act } = await supabase.from('trips').select('*').eq('driver_id', me.id)
      .in('status', ['accepted', 'arrived', 'in_progress']).limit(1);
    setTrip((act?.[0] as Trip) ?? null);
    if (!act?.length && online) {
      const { data } = await supabase.from('trips').select('*').eq('status', 'requested').order('created_at');
      setOpen((data as Trip[] ?? []).filter((t) => !pos || haversineKm(pos, { lat: t.origin_lat, lng: t.origin_lng }) <= RADIUS_KM));
    } else setOpen([]);
  }, [me.id, online, pos]);

  useEffect(() => { loadTrips(); }, [loadTrips]);
  useEffect(() => {
    const ch = supabase.channel('trips-driver')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadTrips()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadTrips]);

  useEffect(() => {
    if (!trip) { setPassenger(null); return; }
    supabase.from('profiles').select('*').eq('id', trip.passenger_id).maybeSingle().then(({ data }) => setPassenger(data as Profile));
  }, [trip?.id, trip?.passenger_id]);

  const accept = async (t: Trip) => {
    const { error } = await supabase.rpc('accept_trip', { p_trip: t.id });
    if (error) Alert.alert('No disponible', error.message);
    loadTrips();
  };

  const advance = async (next: TripStatus) => {
    if (!trip) return;
    const patch: Record<string, unknown> = { status: next };
    if (next === 'completed') patch.completed_at = new Date().toISOString();
    await supabase.from('trips').update(patch).eq('id', trip.id);
    if (next === 'completed') setRate(trip);
    loadTrips();
  };

  const nextBtn: Record<string, { label: string; to: TripStatus } | undefined> = {
    accepted: { label: 'Llegué al punto de recojo', to: 'arrived' },
    arrived: { label: 'Iniciar viaje', to: 'in_progress' },
    in_progress: { label: 'Finalizar viaje', to: 'completed' },
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56, backgroundColor: colors.bg, flexGrow: 1 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>{me.full_name}</Text>
            <Text style={{ color: colors.muted }}>★ {Number(driver.rating_avg).toFixed(1)} · {driver.plate}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Switch value={online} onValueChange={toggle} trackColor={{ true: colors.primary }} />
            <Text style={{ fontSize: 12 }}>{online ? 'En línea' : 'Desconectado'}</Text>
          </View>
        </View>
      </Card>

      {trip && (
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 17 }}>Viaje activo · S/ {Number(trip.fare).toFixed(2)}</Text>
          <Text style={{ marginTop: 6 }}>Pasajero: {passenger?.full_name ?? '…'}</Text>
          <Text>Recojo: {trip.origin_text}</Text>
          <Text>Destino: {trip.dest_text}</Text>
          {passenger && <Button variant="ghost" title="📞 Llamar al pasajero" onPress={() => Linking.openURL(`tel:${passenger.phone}`)} />}
          <Button variant="ghost" title="🗺️ Abrir ruta en Maps" onPress={() => {
            const target = trip.status === 'in_progress' ? [trip.dest_lat, trip.dest_lng] : [trip.origin_lat, trip.origin_lng];
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${target[0]},${target[1]}`);
          }} />
          {nextBtn[trip.status] && <Button title={nextBtn[trip.status]!.label} onPress={() => advance(nextBtn[trip.status]!.to)} />}
          <SosButton trip={trip} profile={me} />
        </Card>
      )}

      {!trip && online && (
        <>
          <Text style={{ fontWeight: '800', marginVertical: 8 }}>Solicitudes cercanas ({open.length})</Text>
          {open.length === 0 && <Text style={{ color: colors.muted }}>Esperando solicitudes…</Text>}
          {open.map((t) => (
            <Card key={t.id}>
              <Text style={{ fontWeight: '700' }}>{t.origin_text} → {t.dest_text}</Text>
              <Text>{Number(t.distance_km).toFixed(1)} km · S/ {Number(t.fare).toFixed(2)}</Text>
              <Button title="Aceptar" onPress={() => accept(t)} />
            </Card>
          ))}
        </>
      )}
      {!online && !trip && <Text style={{ color: colors.muted, marginTop: 10 }}>Activa “En línea” para recibir viajes.</Text>}

      <Button variant="ghost" title="Cerrar sesión" onPress={async () => { await toggle(false); await stopDriverTracking(); await signOut(); }} />
      <DeleteAccountButton />
      <View style={{ height: 30 }} />
      {rate && <RatingModal visible trip={rate} fromId={me.id} toId={rate.passenger_id} onClose={() => { setRate(null); refresh(); }} />}
    </ScrollView>
  );
}

/* ---------- Pantalla principal del chofer ---------- */
export default function DriverHome() {
  const { profile, driver, refresh, signOut } = useAuth();
  const me = profile as Profile;

  if (!driver) return <Onboarding me={me} onDone={refresh} />;

  if (driver.status !== 'approved') {
    const msg = {
      pending: ['⏳ En revisión', 'Estamos validando tu licencia, SOAT y placa. Te avisaremos al aprobarte.'],
      rejected: ['❌ Solicitud rechazada', driver.rejection_reason ?? 'Comunícate con soporte.'],
      suspended: ['⛔ Cuenta suspendida', 'Comunícate con soporte.'],
    }[driver.status as 'pending' | 'rejected' | 'suspended'];
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 26, fontWeight: '800' }}>{msg[0]}</Text>
        <Text style={{ marginVertical: 12 }}>{msg[1]}</Text>
        <Button title="Actualizar estado" onPress={refresh} />
        <Button variant="ghost" title="Cerrar sesión" onPress={signOut} />
        <DeleteAccountButton />
      </View>
    );
  }
  return <Dashboard me={me} driver={driver} refresh={refresh} />;
}
