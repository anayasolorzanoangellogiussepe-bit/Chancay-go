import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { CHANCAY_CENTER, estimateFare, haversineKm } from '../../lib/geo';
import type { Driver, Profile, Trip } from '../../lib/types';
import { Button, Card, colors } from '../../components/ui';
import { RatingModal, ShareTripButton, SosButton } from '../../components/TripSafety';
import { DeleteAccountButton } from '../../components/DeleteAccount';

const STATUS_TEXT: Record<string, string> = {
  requested: 'Buscando chofer cercano…',
  accepted: 'Tu chofer va en camino',
  arrived: 'Tu chofer llegó',
  in_progress: 'Viaje en curso',
  completed: 'Viaje finalizado',
};

async function labelFor(lat: number, lng: number): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const txt = [a?.street, a?.name, a?.district ?? a?.city].filter(Boolean).join(', ');
    return txt || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
}

export default function PassengerHome() {
  const { profile, signOut } = useAuth();
  const me = profile as Profile;
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [dest, setDest] = useState<{ lat: number; lng: number; text: string } | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [driverProfile, setDriverProfile] = useState<Profile | null>(null);
  const [rating, setRating] = useState(false);
  const [busy, setBusy] = useState(false);
  const rated = useRef<string | null>(null);

  // Ubicación actual
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Ubicación requerida', 'Activa la ubicación para pedir un viaje.');
      const p = await Location.getCurrentPositionAsync({});
      setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude });
    })();
  }, []);

  // Viaje activo
  const loadActive = useCallback(async () => {
    const { data } = await supabase.from('trips').select('*').eq('passenger_id', me.id)
      .in('status', ['requested', 'accepted', 'arrived', 'in_progress']).order('created_at', { ascending: false }).limit(1);
    setTrip((data?.[0] as Trip) ?? null);
  }, [me.id]);
  useEffect(() => { loadActive(); }, [loadActive]);

  // Cambios del viaje en tiempo real
  useEffect(() => {
    if (!trip) return;
    const ch = supabase.channel(`trip-${trip.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${trip.id}` },
        (payload) => {
          const t = payload.new as Trip;
          setTrip(t);
          if (t.status === 'completed' && rated.current !== t.id) { rated.current = t.id; setRating(true); }
          if (t.status === 'cancelled') { setTrip(null); Alert.alert('Viaje cancelado'); }
        }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip?.id]);

  // Datos y posición del chofer
  useEffect(() => {
    if (!trip?.driver_id) { setDriver(null); setDriverProfile(null); return; }
    const id = trip.driver_id;
    (async () => {
      const [d, p] = await Promise.all([
        supabase.from('drivers').select('*').eq('id', id).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      ]);
      setDriver(d.data as Driver); setDriverProfile(p.data as Profile);
    })();
    const ch = supabase.channel(`drv-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drivers', filter: `id=eq.${id}` },
        (payload) => setDriver((prev) => ({ ...(prev as Driver), ...(payload.new as Driver) }))).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip?.driver_id]);

  const onMapPress = async (e: MapPressEvent) => {
    if (trip) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDest({ lat: latitude, lng: longitude, text: await labelFor(latitude, longitude) });
  };

  const km = origin && dest ? haversineKm(origin, dest) : 0;
  const fare = estimateFare(km);

  const request = async () => {
    if (!origin || !dest) return;
    setBusy(true);
    const { data, error } = await supabase.from('trips').insert({
      passenger_id: me.id,
      origin_text: await labelFor(origin.lat, origin.lng), origin_lat: origin.lat, origin_lng: origin.lng,
      dest_text: dest.text, dest_lat: dest.lat, dest_lng: dest.lng,
      distance_km: Math.round(km * 1.25 * 100) / 100, fare,
    }).select().single();
    setBusy(false);
    if (error) Alert.alert('Error', error.message); else { setTrip(data as Trip); setDest(null); }
  };

  const cancel = async () => {
    if (!trip) return;
    await supabase.from('trips').update({ status: 'cancelled' }).eq('id', trip.id);
    setTrip(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} initialRegion={CHANCAY_CENTER} showsUserLocation onPress={onMapPress}>
        {dest && <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} title="Destino" pinColor="red" />}
        {driver?.lat != null && driver.lng != null && (
          <Marker coordinate={{ latitude: driver.lat, longitude: driver.lng }} title={driverProfile?.full_name ?? 'Chofer'} pinColor="green" />
        )}
      </MapView>

      <ScrollView style={{ maxHeight: '55%', backgroundColor: colors.bg }} contentContainerStyle={{ padding: 14 }}>
        {!trip && (
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>{dest ? dest.text : 'Toca el mapa para elegir tu destino'}</Text>
            {dest && <Text style={{ marginVertical: 6 }}>{km.toFixed(1)} km aprox. · <Text style={{ fontWeight: '800' }}>S/ {fare.toFixed(2)}</Text></Text>}
            <Button title="Pedir viaje" onPress={request} loading={busy} disabled={!dest || !origin} />
            <Button variant="ghost" title="Cerrar sesión" onPress={signOut} />
            <DeleteAccountButton />
          </Card>
        )}

        {trip && (
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>{STATUS_TEXT[trip.status]}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{trip.origin_text} → {trip.dest_text}</Text>
            <Text style={{ marginVertical: 6 }}>Tarifa: <Text style={{ fontWeight: '800' }}>S/ {Number(trip.fare).toFixed(2)}</Text> (pago en efectivo)</Text>
            {driver && driverProfile && (
              <View style={{ marginVertical: 6 }}>
                <Text style={{ fontWeight: '700' }}>{driverProfile.full_name} · ★ {Number(driver.rating_avg).toFixed(1)} ({driver.rating_count})</Text>
                <Text>{driver.vehicle_model} {driver.vehicle_color} · Placa {driver.plate}</Text>
                <Button variant="ghost" title="📞 Llamar al chofer" onPress={() => Linking.openURL(`tel:${driverProfile.phone}`)} />
              </View>
            )}
            {trip.status !== 'requested' && <ShareTripButton trip={trip} />}
            <SosButton trip={trip} profile={me} />
            {(trip.status === 'requested' || trip.status === 'accepted') && <Button variant="ghost" title="Cancelar viaje" onPress={cancel} />}
          </Card>
        )}
      </ScrollView>

      {trip?.driver_id && (
        <RatingModal visible={rating} trip={trip} fromId={me.id} toId={trip.driver_id}
          onClose={() => { setRating(false); setTrip(null); }} />
      )}
    </View>
  );
}
