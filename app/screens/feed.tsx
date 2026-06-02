import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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

import PostCard, { PostItem } from '@/app/components/PostCard';
import PostComposerModal from '@/app/components/PostComposerModal';
import { auth, db } from '@/firebaseconfig';
import { criarNotificacaoUsuario } from '@/src/services/pushNotificationService';
import { avatarFallback, formatarDataCurta } from '@/src/services/socialServices';
import { isValidEmail, normalizeEmail } from '@/src/utils/validation';

function normalizarBuscaUsuario(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

type Amigo = {
  uid: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
};

type PedidoAmizade = {
  id: string;
  fromUid: string;
  fromNome: string;
  fromEmail: string;
  fromFoto: string | null;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function Feed() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(auth.currentUser);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [pedidos, setPedidos] = useState<PedidoAmizade[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [novoAmigoEmail, setNovoAmigoEmail] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [composerAberto, setComposerAberto] = useState(false);

  const friendIds = useMemo(() => new Set(amigos.map((amigo) => amigo.uid)), [amigos]);
  const avatarUrl = usuario?.photoURL || avatarFallback(usuario?.uid);

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  useEffect(() => {
    if (!usuario) {
      setAmigos([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'usuarios', usuario.uid, 'amigos'),
      (snapshot) => {
        setAmigos(
          snapshot.docs.map((documento) => {
            const dados = documento.data();
            return {
              uid: documento.id,
              nome: String(dados.nome || dados.email || 'Amigo'),
              email: String(dados.email || ''),
              fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
            };
          }),
        );
      },
      (error) => {
        console.error('Erro ao carregar amigos:', error);
        setAmigos([]);
      },
    );

    return () => unsubscribe();
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      setPedidos([]);
      return undefined;
    }

    const pedidosQuery = query(collection(db, 'amizades'), where('toUid', '==', usuario.uid));
    const unsubscribe = onSnapshot(
      pedidosQuery,
      (snapshot) => {
        setPedidos(
          snapshot.docs
            .filter((documento) => documento.data().status === 'pendente')
            .map((documento) => {
              const dados = documento.data();
              return {
                id: documento.id,
                fromUid: String(dados.fromUid || ''),
                fromNome: String(dados.fromNome || dados.fromEmail || 'Usuario'),
                fromEmail: String(dados.fromEmail || ''),
                fromFoto: typeof dados.fromFoto === 'string' ? dados.fromFoto : null,
              };
            }),
        );
      },
      (error) => {
        console.error('Erro ao carregar pedidos de amizade:', error);
        setPedidos([]);
      },
    );

    return () => unsubscribe();
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      setPosts([]);
      setCarregando(false);
      return undefined;
    }

    setCarregando(true);
    const postsQuery = query(collection(db, 'posts'), orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const lista = snapshot.docs
          .map((documento) => {
            const dados = documento.data();
            return {
              id: documento.id,
              uid: String(dados.uid || ''),
              nome: String(dados.nome || 'Usuario'),
              fotoUsuario: typeof dados.fotoUsuario === 'string' ? dados.fotoUsuario : null,
              imagemUrl: String(dados.imagemUrl || ''),
              legenda: String(dados.legenda || ''),
              restaurante: String(dados.restaurante || ''),
              criadoEmTexto: formatarDataCurta(dados.criadoEm),
              storagePath: typeof dados.storagePath === 'string' ? dados.storagePath : null,
            };
          })
          .filter((post) => post.uid === usuario.uid || friendIds.has(post.uid));

        setPosts(lista);
        setCarregando(false);
      },
      (error) => {
        console.error('Erro ao carregar feed:', error);
        setPosts([]);
        setCarregando(false);
      },
    );

    return () => unsubscribe();
  }, [friendIds, usuario]);

  const buscarUsuarioPorTermo = async (termo: string) => {
    const termoNormalizado = normalizarBuscaUsuario(termo);

    if (isValidEmail(termoNormalizado)) {
      const email = normalizeEmail(termoNormalizado);

      const buscaPorLower = await getDocs(
        query(collection(db, 'usuarios'), where('emailLower', '==', email), limit(1)),
      );
      if (!buscaPorLower.empty) return buscaPorLower.docs[0];

      const buscaPorEmail = await getDocs(
        query(collection(db, 'usuarios'), where('email', '==', email), limit(1)),
      );
      return buscaPorEmail.empty ? null : buscaPorEmail.docs[0];
    }

    const usuariosSnapshot = await getDocs(query(collection(db, 'usuarios'), limit(100)));
    const encontrados = usuariosSnapshot.docs.filter((documento) => {
      const dados = documento.data();
      const nome = normalizarBuscaUsuario(String(dados.nome || ''));
      const email = normalizarBuscaUsuario(String(dados.email || ''));

      return nome.includes(termoNormalizado) || email.includes(termoNormalizado);
    });

    return encontrados[0] || null;
  };

  const enviarPedidoAmizade = async () => {
    if (!usuario) return;

    const termoBusca = novoAmigoEmail.trim();
    const termoNormalizado = normalizarBuscaUsuario(termoBusca);
    const pareceEmail = termoBusca.includes('@');

    if (!termoBusca) {
      Alert.alert('Informe um usuario', 'Digite o nome ou email de alguem cadastrado no app.');
      return;
    }
    if (pareceEmail && !isValidEmail(normalizeEmail(termoBusca))) {
      Alert.alert('Email invalido', 'Digite um email valido para adicionar um amigo.');
      return;
    }

    if (
      termoNormalizado === normalizarBuscaUsuario(usuario.email || '') ||
      termoNormalizado === normalizarBuscaUsuario(usuario.displayName || '')
    ) {
      Alert.alert('Esse e voce', 'Use o nome ou email de outra pessoa.');
      return;
    }

    setEnviandoPedido(true);
    try {
      const encontrado = await buscarUsuarioPorTermo(termoBusca);
      if (!encontrado) {
        Alert.alert('Nao encontrado', 'Nenhum usuario cadastrado com esse nome ou email.');
        return;
      }

      if (encontrado.id === usuario.uid) {
        Alert.alert('Esse e voce', 'Use o nome ou email de outra pessoa.');
        return;
      }

      if (friendIds.has(encontrado.id)) {
        Alert.alert('Ja e amigo', 'Esse usuario ja esta na sua lista de amigos.');
        return;
      }

      const dados = encontrado.data();
      const pedidoRef = await addDoc(collection(db, 'amizades'), {
        fromUid: usuario.uid,
        fromNome: usuario.displayName || usuario.email || 'Usuario',
        fromEmail: usuario.email?.toLowerCase() || '',
        fromFoto: usuario.photoURL || null,
        toUid: encontrado.id,
        toNome: String(dados.nome || dados.email || 'Usuario'),
        toEmail: String(dados.email || termoBusca).toLowerCase(),
        toFoto: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
        status: 'pendente',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });

      await criarNotificacaoUsuario(encontrado.id, {
        tipo: 'amizade',
        titulo: 'Pedido de amizade',
        mensagem: `${usuario.displayName || usuario.email || 'Alguem'} quer se conectar com voce.`,
        amizadeId: pedidoRef.id,
        remetenteUid: usuario.uid,
      });

      setNovoAmigoEmail('');
      Alert.alert('Pedido enviado', 'A amizade so aparece quando a pessoa aceitar.');
    } catch (error) {
      console.error('Erro ao enviar pedido de amizade:', error);
      Alert.alert('Erro', 'Nao foi possivel enviar o pedido.');
    } finally {
      setEnviandoPedido(false);
    }
  };

  const responderPedido = async (pedido: PedidoAmizade, resposta: 'aceito' | 'recusado') => {
    if (!usuario) return;

    try {
      if (resposta === 'aceito') {
        await setDoc(doc(db, 'usuarios', usuario.uid, 'amigos', pedido.fromUid), {
          uid: pedido.fromUid,
          nome: pedido.fromNome,
          email: pedido.fromEmail,
          fotoUrl: pedido.fromFoto,
          criadoEm: serverTimestamp(),
        });

        await setDoc(doc(db, 'usuarios', pedido.fromUid, 'amigos', usuario.uid), {
          uid: usuario.uid,
          nome: usuario.displayName || usuario.email || 'Usuario',
          email: usuario.email?.toLowerCase() || '',
          fotoUrl: usuario.photoURL || null,
          criadoEm: serverTimestamp(),
        });

        await criarNotificacaoUsuario(pedido.fromUid, {
          tipo: 'amizade_aceita',
          titulo: 'Amizade aceita',
          mensagem: `${usuario.displayName || usuario.email || 'Alguem'} aceitou seu pedido.`,
        });
      }

      await updateDoc(doc(db, 'amizades', pedido.id), {
        status: resposta,
        atualizadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao responder pedido:', error);
      Alert.alert('Erro', 'Nao foi possivel responder o pedido.');
    }
  };

  const abrirPerfilAmigo = (uid: string) => {
    if (uid === usuario?.uid) {
      router.push('/screens/perfil');
      return;
    }
    router.push(`/screens/perfil-amigo?userId=${uid}` as never);
  };

  const abrirChat = (amigo: Amigo) => {
    router.push(
      `/screens/chat?friendId=${amigo.uid}&friendName=${encodeURIComponent(amigo.nome)}&friendPhoto=${encodeURIComponent(amigo.fotoUrl || '')}` as never,
    );
  };

  if (!usuario) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialIcons name="person-off" size={34} color={BLUE_DARK} />
          <Text style={styles.emptyTitle}>Entre para ver o feed.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/screens/login')}>
            <Text style={styles.primaryButtonText}>Ir para login</Text>
          </TouchableOpacity>
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={22} color={INK} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Feed</Text>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/screens/perfil')}>
              <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Conectar amigos</Text>
            <View style={styles.friendAddRow}>
              <TextInput
                style={styles.friendInput}
                value={novoAmigoEmail}
                onChangeText={setNovoAmigoEmail}
                placeholder="nome ou email do amigo"
                placeholderTextColor="#667085"
                keyboardType="default"
                autoCapitalize="words"
                editable={!enviandoPedido}
              />
              <TouchableOpacity
                style={[styles.friendAddButton, enviandoPedido && styles.disabledButton]}
                onPress={enviarPedidoAmizade}
                disabled={enviandoPedido}
              >
                {enviandoPedido ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {pedidos.length > 0 && (
              <View style={styles.requests}>
                <Text style={styles.smallTitle}>Pedidos pendentes</Text>
                {pedidos.map((pedido) => (
                  <View key={pedido.id} style={styles.requestItem}>
                    <Image
                      source={{ uri: pedido.fromFoto || avatarFallback(pedido.fromUid) }}
                      style={styles.requestAvatar}
                    />
                    <View style={styles.requestText}>
                      <Text style={styles.requestName}>{pedido.fromNome}</Text>
                      <Text style={styles.requestEmail}>{pedido.fromEmail}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => responderPedido(pedido, 'aceito')}
                    >
                      <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => responderPedido(pedido, 'recusado')}
                    >
                      <MaterialIcons name="close" size={18} color="#9F1239" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {amigos.length > 0 && (
            <View style={styles.friendsPanel}>
              <Text style={styles.panelTitle}>Amigos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.friendChips}>
                  {amigos.map((amigo) => (
                    <TouchableOpacity
                      key={amigo.uid}
                      style={styles.friendChip}
                      onPress={() => abrirPerfilAmigo(amigo.uid)}
                    >
                      <Image
                        source={{ uri: amigo.fotoUrl || avatarFallback(amigo.uid) }}
                        style={styles.friendAvatar}
                      />
                      <Text style={styles.friendName} numberOfLines={1}>{amigo.nome}</Text>
                      <TouchableOpacity style={styles.chatMiniButton} onPress={() => abrirChat(amigo)}>
                        <MaterialIcons name="chat-bubble-outline" size={16} color={BLUE_DARK} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <View style={styles.postsList}>
            {carregando ? (
              <ActivityIndicator color={BLUE_DARK} style={styles.loader} />
            ) : posts.length ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={usuario}
                  onOpenAuthor={abrirPerfilAmigo}
                />
              ))
            ) : (
              <View style={styles.emptyFeed}>
                <MaterialIcons name="dynamic-feed" size={34} color={BLUE_DARK} />
                <Text style={styles.emptyTitle}>Sem postagens ainda</Text>
                <Text style={styles.emptyText}>Quando voce e seus amigos publicarem dicas, elas aparecem aqui.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setComposerAberto(true)}>
          <MaterialIcons name="add" size={30} color="#FFFFFF" />
        </TouchableOpacity>

        <PostComposerModal
          visible={composerAberto}
          currentUser={usuario}
          authorName={usuario.displayName || usuario.email || 'Usuario'}
          authorPhoto={usuario.photoURL || null}
          notifyUids={amigos.map((amigo) => amigo.uid)}
          onClose={() => setComposerAberto(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  content: { paddingBottom: 96 },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    overflow: 'hidden',
  },
  headerAvatar: { width: 42, height: 42, borderRadius: 8 },
  headerTitle: { color: INK, fontSize: 24, fontFamily: 'Poppins_700Bold' },
  panel: {
    marginHorizontal: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    marginBottom: 14,
  },
  friendsPanel: {
    marginHorizontal: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    marginBottom: 14,
  },
  panelTitle: { color: INK, fontFamily: 'Poppins_700Bold', fontSize: 16, marginBottom: 10 },
  smallTitle: { color: INK, fontFamily: 'Urbanist_700Bold', fontSize: 13, marginBottom: 8 },
  friendAddRow: { flexDirection: 'row', gap: 8 },
  friendInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 12,
    color: INK,
    backgroundColor: '#FFFFFF',
  },
  friendAddButton: {
    width: 48,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requests: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#E3F2FD', paddingTop: 12 },
  requestItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  requestAvatar: { width: 42, height: 42, borderRadius: 21 },
  requestText: { flex: 1 },
  requestName: { color: INK, fontFamily: 'Urbanist_700Bold', fontSize: 14 },
  requestEmail: { color: '#667085', fontSize: 12, marginTop: 2 },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendChips: { flexDirection: 'row', gap: 10 },
  friendChip: {
    width: 92,
    minHeight: 118,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    alignItems: 'center',
    padding: 8,
  },
  friendAvatar: { width: 54, height: 54, borderRadius: 27, marginBottom: 6 },
  friendName: { color: INK, fontFamily: 'Urbanist_700Bold', fontSize: 12, textAlign: 'center' },
  chatMiniButton: {
    marginTop: 7,
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsList: { marginHorizontal: 18 },
  loader: { marginTop: 24 },
  disabledButton: { opacity: 0.65 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyFeed: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
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
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 7,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
});
