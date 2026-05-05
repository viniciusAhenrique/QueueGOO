import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PostCard, { PostItem } from '@/app/components/PostCard';
import { auth, db } from '@/firebaseconfig';
import { avatarFallback, formatarDataCurta } from '@/src/services/socialServices';

type PerfilAmigo = {
  uid: string;
  nome: string;
  email: string;
  fotoUrl: string | null;
  cidade: string;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function PerfilAmigoScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [usuario, setUsuario] = useState<User | null>(auth.currentUser);
  const [perfil, setPerfil] = useState<PerfilAmigo | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      setCarregando(true);
      try {
        const snapshot = await getDoc(doc(db, 'usuarios', userId));
        const dados = snapshot.exists() ? snapshot.data() : {};

        setPerfil({
          uid: userId,
          nome: String(dados.nome || dados.email || 'Usuario'),
          email: String(dados.email || ''),
          fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
          cidade: String(dados.cidade || ''),
        });
      } catch (error) {
        console.error('Erro ao carregar perfil do amigo:', error);
        setPerfil(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const postsQuery = query(collection(db, 'posts'), orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          snapshot.docs
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
            .filter((post) => post.uid === userId),
        );
      },
      (error) => {
        console.error('Erro ao carregar posts do amigo:', error);
        setPosts([]);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  const abrirChat = () => {
    if (!perfil) return;

    router.push(
      `/screens/chat?friendId=${perfil.uid}&friendName=${encodeURIComponent(perfil.nome)}&friendPhoto=${encodeURIComponent(perfil.fotoUrl || '')}` as never,
    );
  };

  if (!usuario) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Entre para ver perfis.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={BLUE_DARK} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Perfil nao encontrado.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Perfil</Text>
          <TouchableOpacity style={styles.iconButton} onPress={abrirChat}>
            <MaterialIcons name="chat-bubble-outline" size={22} color={BLUE_DARK} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHeader}>
          <Image source={{ uri: perfil.fotoUrl || avatarFallback(perfil.uid) }} style={styles.avatar} />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{perfil.nome}</Text>
            <Text style={styles.email} numberOfLines={1}>{perfil.email}</Text>
            <View style={styles.statsInline}>
              <StatBlock label="Posts" value={String(posts.length)} />
              <StatBlock label="Status" value="Amigo" />
              <StatBlock label="Cidade" value={perfil.cidade || '-'} />
            </View>
            <TouchableOpacity style={styles.chatButton} onPress={abrirChat}>
              <MaterialIcons name="chat-bubble-outline" size={17} color="#FFFFFF" />
              <Text style={styles.chatButtonText}>Conversar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.postsHeader}>
          <Text style={styles.sectionTitle}>Postagens</Text>
        </View>

        <View style={styles.postsList}>
          {posts.length ? (
            posts.map((post) => <PostCard key={post.id} post={post} currentUser={usuario} />)
          ) : (
            <View style={styles.emptyPosts}>
              <MaterialIcons name="photo-library" size={34} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Sem postagens</Text>
              <Text style={styles.emptyText}>As dicas deste amigo aparecem aqui.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type StatBlockProps = {
  label: string;
  value: string;
};

function StatBlock({ label, value }: StatBlockProps) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  content: { paddingBottom: 34 },
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
  },
  headerTitle: { color: INK, fontSize: 22, fontFamily: 'Poppins_700Bold' },
  profileHeader: {
    marginHorizontal: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#BBDEFB',
  },
  profileInfo: { flex: 1, marginLeft: 14 },
  name: { fontSize: 21, color: INK, fontFamily: 'Poppins_700Bold' },
  email: { marginTop: 1, color: '#4B6475', fontSize: 13 },
  statsInline: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statBlock: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statValue: { color: BLUE_DARK, fontFamily: 'Poppins_700Bold', fontSize: 14, maxWidth: '100%' },
  statLabel: { color: '#4B6475', fontSize: 11, marginTop: 2, fontFamily: 'Urbanist_700Bold' },
  chatButton: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  chatButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold', fontSize: 14 },
  postsHeader: {
    marginTop: 16,
    marginHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: INK, fontSize: 17, fontFamily: 'Poppins_700Bold' },
  postsList: { marginTop: 12, marginHorizontal: 18 },
  emptyPosts: {
    minHeight: 190,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: { color: '#667085', textAlign: 'center', lineHeight: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyTitle: { color: INK, fontSize: 18, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
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
