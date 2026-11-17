import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Muestra el aviso aunque la app esté abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

/** Pide permiso, obtiene el token de Expo y lo guarda en el perfil. Devuelve el token o null. */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null; // los simuladores no reciben push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('viajes', {
      name: 'Viajes', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300], sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // se obtiene al ejecutar `eas init`
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await supabase.from('push_tokens').upsert({ user_id: userId, token, updated_at: new Date().toISOString() });
  return token;
}

/** Borra el token al cerrar sesión para no recibir avisos de otra persona en el mismo teléfono. */
export async function clearPushToken(userId: string) {
  await supabase.from('push_tokens').delete().eq('user_id', userId);
}
