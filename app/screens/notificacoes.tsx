import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, db } from '@/firebaseconfig';
import { avatarFallback } from '@/src/services/socialServices';

type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  eventoId?: string;
  chatId?: string;
  remetenteUid?: string;
  criadoEmTexto: string;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

function formatarCriadoEm(value: unknown) {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return '';
}

function iconForType(tipo: string) {
  if (tipo.includes('amizade')) return 'person-add';
  if (tipo.includes('evento') || tipo.includes('convite')) return 'event';
  if (tipo.includes('chat')) return 'chat-bubble-outline';
  if (tipo.includes('post')) return 'dynamic-feed';
  if (tipo.includes('comentario')) return 'comment';
  return 'notifications';
}

export default function Notificacoes() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(auth.currentUser);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const pendentes = useMemo(
    () => notificacoes.filter((notificacao) => !notificacao.lida).length,
    [notificacoes],
  );

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  useEffect(() => {
    if (!usuario) {
      setNotificacoes([]);
      setCarregando(false);
      return undefined;
    }

    setCarregando(true);
    const notificacoesQuery = query(
      collection(db, 'usuarios', usuario.uid, 'notificacoes'),
      orderBy('criadoEm', 'desc'),
    );

    const unsubscribe = onSnapshot(
      notificacoesQuery,
      (snapshot) => {
        setNotificacoes(
          snapshot.docs.map((documento) => {
            const dados = documento.data();
            return {
              id: documento.id,
              tipo: String(dados.tipo || 'notificacao'),
              titulo: String(dados.titulo || 'Notificacao'),
              mensagem: String(dados.mensagem || ''),
              lida: Boolean(dados.lida),
              eventoId: typeof dados.eventoId === 'string' ? dados.eventoId : undefined,
              chatId: typeof dados.chatId === 'string' ? dados.chatId : undefined,
              remetenteUid:
                typeof dados.remetenteUid === 'string' ? dados.remetenteUid : undefined,
              criadoEmTexto: formatarCriadoEm(dados.criadoEm),
            };
          }),
        );
        setCarregando(false);
      },
      (error) => {
        console.error('Erro ao carregar notificacoes:', error);
        setNotificacoes([]);
        setCarregando(false);
      },
    );

    return () => unsubscribe();
  }, [usuario]);

  const marcarComoLida = async (notificacao: Notificacao) => {
    if (!usuario || notificacao.lida) return;
    await updateDoc(doc(db, 'usuarios', usuario.uid, 'notificacoes', notificacao.id), {
      lida: true,
    });
  };

  const marcarTodasComoLidas = async () => {
    if (!usuario) return;
    const naoLidas = notificacoes.filter((notificacao) => !notificacao.lida);
    if (!naoLidas.length) return;

    const batch = writeBatch(db);
    naoLidas.forEach((notificacao) => {
      batch.update(doc(db, 'usuarios', usuario.uid, 'notificacoes', notificacao.id), {
        lida: true,
      });
    });

    await batch.commit();
  };

  const apagarNotificacao = (notificacao: Notificacao) => {
    if (!usuario) return;

    Alert.alert('Apagar notificacao?', 'Essa notificacao sera removida da sua lista.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'usuarios', usuario.uid, 'notificacoes', notificacao.id));
        },
      },
    ]);
  };

  const apagarNotificacoesLidas = () => {
    if (!usuario) return;

    const lidas = notificacoes.filter((notificacao) => notificacao.lida);
    const alvo = lidas.length ? lidas : notificacoes;
    if (!alvo.length) return;

    Alert.alert(
      lidas.length ? 'Apagar notificacoes lidas?' : 'Apagar todas as notificacoes?',
      lidas.length
        ? `${lidas.length} notificacao(oes) lida(s) serao removidas.`
        : 'Nao ha notificacoes lidas. Todas as notificacoes serao removidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            const batch = writeBatch(db);
            alvo.forEach((notificacao) => {
              batch.delete(doc(db, 'usuarios', usuario.uid, 'notificacoes', notificacao.id));
            });
            await batch.commit();
          },
        },
      ],
    );
  };

  const abrirNotificacao = async (notificacao: Notificacao) => {
    await marcarComoLida(notificacao);

    if (notificacao.eventoId) {
      router.push(`/screens/social?eventoId=${notificacao.eventoId}` as never);
      return;
    }

    if (notificacao.tipo.includes('chat')) {
      router.push('/screens/feed');
      return;
    }

    if (notificacao.tipo.includes('post')) {
      router.push('/screens/feed');
      return;
    }

    if (notificacao.tipo.includes('amizade')) {
      router.push('/screens/feed');
      return;
    }
  };

  if (!usuario) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialIcons name="lock" size={34} color={BLUE_DARK} />
          <Text style={styles.emptyTitle}>Entre para ver notificacoes</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/screens/login')}>
            <Text style={styles.primaryButtonText}>Ir para login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Notificacoes</Text>
          <Text style={styles.headerSubtitle}>
            {pendentes ? `${pendentes} nao lida${pendentes > 1 ? 's' : ''}` : 'Tudo em dia'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, !pendentes && styles.iconButtonDisabled]}
            onPress={marcarTodasComoLidas}
            disabled={!pendentes}
          >
            <MaterialIcons name="done-all" size={22} color={pendentes ? BLUE_DARK : '#94A3B8'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, !notificacoes.length && styles.iconButtonDisabled]}
            onPress={apagarNotificacoesLidas}
            disabled={!notificacoes.length}
          >
            <MaterialIcons name="delete-sweep" size={22} color={notificacoes.length ? '#9F1239' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator color={BLUE_DARK} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notificacoes.length ? (
            notificacoes.map((notificacao) => (
              <TouchableOpacity
                key={notificacao.id}
                style={[styles.card, !notificacao.lida && styles.cardUnread]}
                onPress={() => abrirNotificacao(notificacao)}
              >
                <View style={styles.iconBubble}>
                  {notificacao.remetenteUid ? (
                    <Image
                      source={{ uri: avatarFallback(notificacao.remetenteUid) }}
                      style={styles.avatar}
                    />
                  ) : (
                    <MaterialIcons
                      name={iconForType(notificacao.tipo)}
                      size={21}
                      color={BLUE_DARK}
                    />
                  )}
                </View>
                <View style={styles.cardText}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{notificacao.titulo}</Text>
                    {!notificacao.lida && <View style={styles.unreadDot} />}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        apagarNotificacao(notificacao);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Apagar notificacao"
                    >
                      <MaterialIcons name="delete-outline" size={19} color="#9F1239" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardMessage}>{notificacao.mensagem}</Text>
                  {!!notificacao.criadoEmTexto && (
                    <Text style={styles.cardDate}>{notificacao.criadoEmTexto}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyStateInline}>
              <MaterialIcons name="notifications-none" size={34} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Nenhuma notificacao ainda</Text>
              <Text style={styles.emptyText}>
                Convites, mensagens, posts e pedidos de amizade aparecem aqui.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  topBar: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: { opacity: 0.65 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerText: { flex: 1 },
  headerTitle: { color: INK, fontSize: 24, fontFamily: 'Poppins_700Bold' },
  headerSubtitle: { color: '#3B5366', fontSize: 12, marginTop: 2 },
  content: { padding: 18, paddingBottom: 34 },
  card: {
    minHeight: 82,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  cardUnread: { borderColor: BLUE_DARK, backgroundColor: '#F8FCFF' },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 44, height: 44, borderRadius: 8 },
  cardText: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, color: INK, fontSize: 15, fontFamily: 'Urbanist_700Bold' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: BLUE_DARK },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMessage: { color: '#4B6475', lineHeight: 19, marginTop: 4 },
  cardDate: { color: '#64748B', fontSize: 12, marginTop: 7 },
  loader: { marginTop: 40 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyStateInline: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { color: INK, fontSize: 17, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
  emptyText: { color: '#667085', textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold' },
});
