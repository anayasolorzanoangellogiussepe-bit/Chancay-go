import React from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Button } from './ui';

/** Eliminación de cuenta dentro de la app (requisito de Apple y Google). */
export function DeleteAccountButton() {
  const confirm = () =>
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borrarán tus datos personales y no podrás volver a ingresar con esta cuenta. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_my_account');
            if (error) return Alert.alert('No se pudo eliminar', error.message);
            await supabase.auth.signOut();
          },
        },
      ]
    );
  return <Button variant="ghost" title="Eliminar mi cuenta" onPress={confirm} />;
}
