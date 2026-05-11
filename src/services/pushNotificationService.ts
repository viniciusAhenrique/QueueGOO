import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from '@/firebaseconfig';

type NotificationPayload = {
  tipo: string;
  titulo: string;
  mensagem: string;
  eventoId?: string;
  chatId?: string;
  postId?: string;
  amizadeId?: string;
  remetenteUid?: string;
  link?: string;
};

type ExpoPushMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, string | undefined>;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function projectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.expoConfig?.extra?.projectId
  );
}

export async function registrarPushTokenDoUsuario(userId: string) {
  if (!userId) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0D47A1',
      });
    }

    const permissoesAtuais = await Notifications.getPermissionsAsync();
    let status = permissoesAtuais.status;

    if (status !== 'granted') {
      const solicitadas = await Notifications.requestPermissionsAsync();
      status = solicitadas.status;
    }

    if (status !== 'granted') {
      await setDoc(
        doc(db, 'usuarios', userId),
        {
          pushNotificationsEnabled: false,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );
      return null;
    }

    const idProjeto = projectId();
    const token = (await Notifications.getExpoPushTokenAsync(idProjeto ? { projectId: idProjeto } : undefined)).data;

    await setDoc(
      doc(db, 'usuarios', userId),
      {
        expoPushTokens: arrayUnion(token),
        pushNotificationsEnabled: true,
        atualizadoEm: serverTimestamp(),
      },
      { merge: true },
    );

    return token;
  } catch (error) {
    console.warn('Nao foi possivel registrar push token:', error);
    return null;
  }
}

export function escutarAberturaDePush() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationPayload;

    if (data?.eventoId) {
      router.push(`/screens/social?eventoId=${data.eventoId}` as never);
      return;
    }

    if (data?.chatId || data?.postId || data?.tipo?.includes('chat') || data?.tipo?.includes('post')) {
      router.push('/screens/feed' as never);
      return;
    }

    router.push('/screens/notificacoes' as never);
  });
}

export async function criarNotificacaoUsuario(userId: string, payload: NotificationPayload) {
  if (!userId) return;

  await addDoc(collection(db, 'usuarios', userId, 'notificacoes'), {
    ...payload,
    lida: false,
    criadoEm: serverTimestamp(),
  });

  await enviarPushParaUsuario(userId, payload);
}

async function enviarPushParaUsuario(userId: string, payload: NotificationPayload) {
  try {
    const snapshot = await getDoc(doc(db, 'usuarios', userId));
    const dados = snapshot.data();
    const tokens = Array.isArray(dados?.expoPushTokens) ? dados.expoPushTokens : [];

    if (dados?.pushNotificationsEnabled === false || !tokens.length) return;

    const mensagens: ExpoPushMessage[] = tokens
      .filter((token): token is string => typeof token === 'string' && token.startsWith('ExpoPushToken'))
      .map((token) => ({
        to: token,
        sound: 'default',
        title: payload.titulo,
        body: payload.mensagem,
        data: {
          tipo: payload.tipo,
          eventoId: payload.eventoId,
          chatId: payload.chatId,
          postId: payload.postId,
          amizadeId: payload.amizadeId,
          remetenteUid: payload.remetenteUid,
        },
      }));

    if (!mensagens.length) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mensagens),
    });
  } catch (error) {
    console.warn('Push notification ignorada:', error);
  }
}
