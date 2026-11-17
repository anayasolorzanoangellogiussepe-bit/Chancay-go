import React, { useState } from 'react';
import { Alert, Linking, Modal, Share, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import type { Profile, Trip } from '../lib/types';
import { Button, Field, colors } from './ui';

const SHARE_BASE = process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? '';

/** Botón SOS: registra la alerta con ubicación y ofrece llamar a emergencias o al contacto. */
export function SosButton({ trip, profile }: { trip: Trip | null; profile: Profile }) {
  const send = async () => {
    let lat: number | null = null, lng: number | null = null;
    try {
      const pos = await Location.getCurrentPositionAsync({});
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch { /* se envía sin coordenadas */ }
    await supabase.from('sos_alerts').insert({ trip_id: trip?.id ?? null, user_id: profile.id, lat, lng });
    const maps = lat != null ? `https://maps.google.com/?q=${lat},${lng}` : 'ubicación no disponible';
    const buttons = [
      { text: 'Llamar a Policía (105)', onPress: () => Linking.openURL('tel:105') },
      ...(profile.emergency_phone
        ? [{ text: `Avisar a ${profile.emergency_name ?? 'contacto'}`,
             onPress: () => Linking.openURL(`sms:${profile.emergency_phone}?body=${encodeURIComponent(`¡EMERGENCIA! Necesito ayuda. ${maps}`)}`) }]
        : []),
      { text: 'Cerrar', style: 'cancel' as const },
    ];
    Alert.alert('Alerta enviada', 'Se notificó a la central de ChancayGo.', buttons);
  };
  return (
    <Button variant="danger" title="🆘 SOS EMERGENCIA"
      onPress={() => Alert.alert('¿Enviar alerta SOS?', 'Se enviará tu ubicación a la central.', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Enviar', style: 'destructive', onPress: send },
      ])} />
  );
}

/** Comparte un enlace de seguimiento en vivo (página web pública sin datos sensibles). */
export function ShareTripButton({ trip }: { trip: Trip }) {
  return (
    <Button variant="ghost" title="📍 Compartir viaje en vivo"
      onPress={() => Share.share({
        message: `Sigo mi viaje en ChancayGo de ${trip.origin_text} a ${trip.dest_text}. Mira dónde voy: ${SHARE_BASE}?t=${trip.share_token}`,
      })} />
  );
}

/** Calificación mutua + reporte opcional. */
export function RatingModal({ visible, trip, fromId, toId, onClose }: {
  visible: boolean; trip: Trip; fromId: string; toId: string; onClose: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from('ratings').insert({ trip_id: trip.id, from_id: fromId, to_id: toId, stars, comment: comment || null });
    if (!error && report) {
      await supabase.from('reports').insert({ trip_id: trip.id, reporter_id: fromId, reported_id: toId, reason: 'Incidencia en el viaje', details: comment || null });
    }
    setBusy(false);
    if (error && !error.message.includes('duplicate')) Alert.alert('Error', error.message);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
        <View style={{ backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 10 }}>¿Cómo fue el viaje?</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Text key={n} onPress={() => setStars(n)} style={{ fontSize: 38, color: n <= stars ? '#F5A623' : '#ccc' }}>★</Text>
            ))}
          </View>
          <Field label="Comentario (opcional)" value={comment} onChangeText={setComment} multiline />
          <Text onPress={() => setReport(!report)} style={{ color: report ? colors.danger : colors.muted, marginBottom: 8 }}>
            {report ? '☑' : '☐'} Reportar un problema de seguridad o conducta
          </Text>
          <Button title="Enviar" onPress={submit} loading={busy} />
        </View>
      </View>
    </Modal>
  );
}
