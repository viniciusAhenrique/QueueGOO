import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, db } from '@/firebaseconfig';
import { avatarFallback, chatIdEntre } from '@/src/services/socialServices';

type Mensagem = {
  id: string;
  uid: string;
  nome: string;
  texto: string;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function ChatDireto() {
  const router = useRouter();
  const { friendId, friendName, friendPhoto } = useLocalSearchParams<{
    friendId?: string;
    friendName?: string;
    friendPhoto?: string;
  }>();
  const [usuario, setUsuario] = useState<User | null>(auth.currentUser);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(true);

  const nomeAmigo = typeof friendName === 'string' && friendName ? friendName : 'Amigo';
  const fotoAmigo = typeof friendPhoto === 'string' && friendPhoto ? friendPhoto : null;
  const chatId = useMemo(
    () => (usuario?.uid && friendId ? chatIdEntre(usuario.uid, friendId) : ''),
    [friendId, usuario?.uid],
  );
  const participantesOrdenados = useMemo(
    () => (usuario?.uid && friendId ? [usuario.uid, friendId].sort() : []),
    [friendId, usuario?.uid],
  );

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  useEffect(() => {
    if (!usuario?.uid || !friendId || !chatId) {
      setCarregando(false);
      return undefined;
    }

    let ativo = true;
    let unsubscribe: (() => void) | undefined;

    const prepararChat = async () => {
      setCarregando(true);
      try {
        const amizade = await getDoc(doc(db, 'usuarios', usuario.uid, 'amigos', friendId));
        if (!amizade.exists()) {
          if (!ativo) return;
          setMensagens([]);
          setCarregando(false);
          Alert.alert('Amizade pendente', 'O chat direto fica disponivel depois que o pedido for aceito.');
          return;
        }

        const chatRef = doc(db, 'chats', chatId);
        await setDoc(
          chatRef,
          {
            participantes: participantesOrdenados,
            userA: participantesOrdenados[0],
            userB: participantesOrdenados[1],
            atualizadoEm: serverTimestamp(),
            participantesInfo: {
              [usuario.uid]: {
                nome: usuario.displayName || usuario.email || 'Usuario',
                fotoUrl: usuario.photoURL || null,
              },
              [friendId]: {
                nome: nomeAmigo,
                fotoUrl: fotoAmigo,
              },
            },
          },
          { merge: true },
        );

        if (!ativo) return;

        const mensagensQuery = query(
          collection(db, 'chats', chatId, 'mensagens'),
          orderBy('criadoEm', 'asc'),
        );

        unsubscribe = onSnapshot(
          mensagensQuery,
          (snapshot) => {
            setMensagens(
              snapshot.docs.map((documento) => {
                const dados = documento.data();
                return {
                  id: documento.id,
                  uid: String(dados.uid || ''),
                  nome: String(dados.nome || 'Usuario'),
                  texto: String(dados.texto || ''),
                };
              }),
            );
            setCarregando(false);
          },
          (error) => {
            console.error('Erro ao carregar chat:', error);
            setMensagens([]);
            setCarregando(false);
          },
        );
      } catch (error) {
        console.error('Erro ao preparar chat:', error);
        if (!ativo) return;
        setMensagens([]);
        setCarregando(false);
        Alert.alert('Erro no chat', 'Nao foi possivel abrir a conversa. Confira as regras do Firestore.');
      }
    };

    prepararChat();

    return () => {
      ativo = false;
      unsubscribe?.();
    };
  }, [chatId, fotoAmigo, friendId, nomeAmigo, participantesOrdenados, usuario]);

  const enviarMensagem = async () => {
    if (!usuario?.uid || !friendId || !chatId) return;

    const mensagem = texto.trim();
    if (!mensagem) return;

    setTexto('');
    try {
      await addDoc(collection(db, 'chats', chatId, 'mensagens'), {
        uid: usuario.uid,
        nome: usuario.displayName || usuario.email || 'Usuario',
        texto: mensagem,
        criadoEm: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'chats', chatId),
        {
          participantes: participantesOrdenados,
          userA: participantesOrdenados[0],
          userB: participantesOrdenados[1],
          ultimaMensagem: mensagem,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );

      await addDoc(collection(db, 'usuarios', friendId, 'notificacoes'), {
        tipo: 'chat',
        titulo: 'Nova mensagem',
        mensagem: `${usuario.displayName || usuario.email || 'Alguem'} enviou uma mensagem.`,
        chatId,
        remetenteUid: usuario.uid,
        lida: false,
        criadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem direta:', error);
      Alert.alert('Erro', 'Nao foi possivel enviar a mensagem.');
      setTexto(mensagem);
    }
  };

  if (!usuario) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Entre para conversar.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <Image source={{ uri: fotoAmigo || avatarFallback(friendId) }} style={styles.avatar} />
          <View style={styles.headerText}>
            <Text style={styles.friendName}>{nomeAmigo}</Text>
            <Text style={styles.headerSubtitle}>Chat direto</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {carregando ? (
            <ActivityIndicator color={BLUE_DARK} style={styles.loader} />
          ) : mensagens.length ? (
            mensagens.map((mensagem) => {
              const minha = mensagem.uid === usuario.uid;
              return (
                <View key={mensagem.id} style={[styles.message, minha && styles.myMessage]}>
                  <Text style={styles.messageName}>{mensagem.nome}</Text>
                  <Text style={styles.messageText}>{mensagem.texto}</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyChat}>
              <MaterialIcons name="chat-bubble-outline" size={34} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Comece a conversa</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Mensagem"
            placeholderTextColor="#667085"
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={enviarMensagem}>
            <MaterialIcons name="send" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  headerText: { flex: 1 },
  friendName: { color: INK, fontSize: 16, fontFamily: 'Urbanist_700Bold' },
  headerSubtitle: { color: '#667085', fontSize: 12, marginTop: 2 },
  messages: { padding: 18, paddingBottom: 100 },
  message: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 10,
    marginBottom: 8,
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#D8EEFF' },
  messageName: { color: BLUE_DARK, fontWeight: '800', fontSize: 12, marginBottom: 3 },
  messageText: { color: INK, lineHeight: 19 },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: 30 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, gap: 8 },
  emptyTitle: { color: INK, fontSize: 18, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
});
