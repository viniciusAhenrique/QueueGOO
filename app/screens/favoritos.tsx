import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, db } from '@/firebaseconfig';

const BLUE = '#4FC3F7';
const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

interface Restaurante {
  id: string;
  placeId: string;
  nome: string;
  tipo: string;
  lotacao: number;
  foto: string | null;
}

function getStatus(lotacao: number) {
  if (lotacao < 40) return { label: 'Tranquilo', color: '#34C759', bg: '#E9F9EE' };
  if (lotacao < 70) return { label: 'Movimento medio', color: '#B7791F', bg: '#FFF4D6' };
  return { label: 'Cheio', color: '#C62828', bg: '#FDECEC' };
}

export default function Favoritos() {
  const [favoritos, setFavoritos] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const router = useRouter();

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const buscarFavoritos = useCallback(async () => {
    if (!user) {
      setFavoritos([]);
      setLoading(false);
      return;
    }

    try {
      const snap = await getDocs(collection(db, 'usuarios', user.uid, 'favoritos'));
      const lista: Restaurante[] = snap.docs.map((documento) => {
        const data = documento.data();
        return {
          id: documento.id,
          placeId: data.placeId || documento.id,
          nome: data.nome,
          tipo: data.tipo || 'Restaurante',
          lotacao: Number(data.lotacao || 0),
          foto: data.foto || null,
        };
      });
      setFavoritos(lista);
    } catch (error) {
      console.error('Erro ao buscar favoritos:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar seus favoritos.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    buscarFavoritos();
  }, [buscarFavoritos]);

  const removerFavorito = async (id: string) => {
    if (!user) {
      Alert.alert('Erro', 'Usuario nao autenticado.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'usuarios', user.uid, 'favoritos', id));
      setFavoritos((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      Alert.alert('Erro', 'Nao foi possivel remover o favorito.');
    }
  };

  const irParaRestaurante = (placeId: string) => {
    router.push({
      pathname: '/screens/restaurante',
      params: { placeId },
    });
  };

  const renderDireita = (id: string) => (
    <TouchableOpacity style={styles.swipeRemover} onPress={() => removerFavorito(id)}>
      <MaterialIcons name="delete" size={24} color="#fff" />
      <Text style={styles.swipeText}>Remover</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: Restaurante }) => {
    const status = getStatus(item.lotacao);

    return (
      <Swipeable renderRightActions={() => renderDireita(item.id)}>
        <TouchableOpacity
          onPress={() => irParaRestaurante(item.placeId)}
          style={styles.card}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: item.foto ?? 'https://via.placeholder.com/240x180?text=QueueGOO' }}
            style={styles.image}
          />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={2}>{item.nome}</Text>
              <MaterialIcons name="chevron-right" size={22} color="#78909C" />
            </View>
            <Text style={styles.type}>{item.tipo}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <MaterialIcons name="circle" size={10} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label} - {item.lotacao}% ocupado
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Favoritos</Text>
            <Text style={styles.subtitle}>{favoritos.length} restaurantes salvos</Text>
          </View>
          <View style={styles.iconButtonGhost}>
            <MaterialIcons name="favorite" size={22} color={BLUE_DARK} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={BLUE_DARK} style={styles.loader} />
        ) : (
          <FlatList
            data={favoritos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons name="favorite-border" size={34} color={BLUE_DARK} />
                </View>
                <Text style={styles.emptyTitle}>Nenhum favorito ainda</Text>
                <Text style={styles.emptyText}>Salve restaurantes pelo mapa para encontrar tudo rapido depois.</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/screens/mapa')}>
                  <Text style={styles.primaryButtonText}>Abrir mapa</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  iconButtonGhost: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 25,
    fontFamily: 'Poppins_700Bold',
    color: INK,
  },
  subtitle: {
    color: '#4B6475',
    marginTop: 2,
    fontFamily: 'Urbanist_500Medium',
  },
  loader: {
    marginTop: 60,
  },
  list: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  image: {
    width: 86,
    height: 86,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#BBDEFB',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Urbanist_700Bold',
    color: INK,
    lineHeight: 21,
  },
  type: {
    color: '#607D8B',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 9,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 9,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Urbanist_700Bold',
  },
  swipeRemover: {
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    height: 106,
    borderRadius: 8,
    marginBottom: 12,
  },
  swipeText: {
    color: '#fff',
    fontFamily: 'Urbanist_700Bold',
    fontSize: 12,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    marginBottom: 16,
  },
  emptyTitle: {
    color: INK,
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  emptyText: {
    color: '#4B6475',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist_700Bold',
  },
});
