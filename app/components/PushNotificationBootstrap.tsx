import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';

import { auth } from '@/firebaseconfig';
import {
  escutarAberturaDePush,
  registrarPushTokenDoUsuario,
} from '@/src/services/pushNotificationService';

export function PushNotificationBootstrap() {
  useEffect(() => {
    const subscription = escutarAberturaDePush();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        registrarPushTokenDoUsuario(user.uid);
      }
    });

    return () => {
      subscription.remove();
      unsubscribeAuth();
    };
  }, []);

  return null;
}
