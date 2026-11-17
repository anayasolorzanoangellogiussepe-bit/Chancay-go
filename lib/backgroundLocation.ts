import { Alert } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

export const LOCATION_TASK = 'chancaygo-driver-location';

// Se ejecuta aunque la pantalla esté bloqueada. Debe definirse al cargar la app (se importa en app/_layout.tsx).
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations[locations.length - 1];
  if (!last) return;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return;
  await supabase.from('drivers').update({
    lat: last.coords.latitude, lng: last.coords.longitude, location_at: new Date().toISOString(),
  }).eq('id', s.session.user.id);
});

/** Aviso destacado exigido por Google Play antes de pedir ubicación en segundo plano. */
function disclosure(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      'Ubicación en segundo plano',
      'ChancayGo recopila tu ubicación mientras estás "En línea", incluso con la app cerrada o la pantalla bloqueada, para que los pasajeros te vean llegar y te asignemos viajes cercanos. Dejas de compartirla al desconectarte.',
      [{ text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
       { text: 'Continuar', onPress: () => resolve(true) }],
      { cancelable: false }
    )
  );
}

/** Inicia el seguimiento. Si no hay permiso de segundo plano, queda solo en primer plano (devuelve false). */
export async function startDriverTracking(): Promise<{ ok: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, background: false };

  try {
    let bg = (await Location.getBackgroundPermissionsAsync()).status === 'granted';
    if (!bg && (await disclosure())) {
      bg = (await Location.requestBackgroundPermissionsAsync()).status === 'granted';
    }
    if (!bg) return { ok: true, background: false };
    await beginBackground();
    return { ok: true, background: true };
  } catch {
    // Expo Go y algunos equipos no admiten segundo plano: se continúa solo con la app abierta
    return { ok: true, background: false };
  }
}

async function beginBackground() {
  if (!(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'ChancayGo · En línea',
        notificationBody: 'Compartiendo tu ubicación para recibir y realizar viajes.',
        notificationColor: '#0B6E4F',
      },
    });
  }
}

export async function stopDriverTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
