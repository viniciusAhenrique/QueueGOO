import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '@/firebaseconfig';

const db = getFirestore(app);

interface Restaurante {
  id: string;
  nome: string;
  tipo: string;
  lotacao: number;
  foto: string | null;
}

export default function Favoritos() {
  const [favoritos, setFavoritos] = useState<Restaurante[]>([]);
  const router = useRouter();
  const user = getAuth().currentUser;

  useEffect(() => {
    if (user) buscarFavoritos();
  }, []);

  const buscarFavoritos = async () => {
    try {
      const snap = await getDocs(collection(db, 'usuarios', user!.uid, 'favoritos'));
      const lista: Restaurante[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Restaurante),
      }));
      setFavoritos(lista);
    } catch (error) {
      console.error('Erro ao buscar favoritos:', error);
    }
  };

  const removerFavorito = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'usuarios', user!.uid, 'favoritos', id));
      setFavoritos((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Erro ao remover favorito:', error);
      Alert.alert('Erro', 'Não foi possível remover o favorito.');
    }
  };

  const irParaRestaurante = (placeId: string) => {
    router.push({
      pathname: '/restaurante',
      params: { placeId },
    });
  };

  const getCorLotacao = (lotacao: number) => {
    if (lotacao < 40) return '#4caf50';
    if (lotacao < 70) return '#ffc107';
    return '#f44336';
  };

  const renderDireita = (id: string) => (
    <View style={styles.swipeRemover}>
      <MaterialIcons name="delete" size={24} color="#fff" />
      <Text style={{ color: '#fff' }}>Remover</Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Restaurantes Favoritos</Text>

        <FlatList
          data={favoritos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => renderDireita(item.id)}
              onSwipeableOpen={() => removerFavorito(item.id)}
            >
              <TouchableOpacity onPress={() => irParaRestaurante(item.id)} style={styles.card}>
                <Image
                  source={{ uri: item.foto ?? 'https://via.placeholder.com/150' }}
                  style={styles.image}
                />
                <View style={styles.info}>
                  <Text style={styles.name}>{item.nome}</Text>
                  <Text style={styles.type}>{item.tipo}</Text>
                  <View style={styles.status}>
                    <MaterialIcons
                      name="circle"
                      size={14}
                      color={getCorLotacao(item.lotacao)}
                    />
                    <Text style={styles.lotacaoTexto}> {item.lotacao}% ocupado</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Você ainda não tem favoritos 😔</Text>
          }
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4FC3F7',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 20,
    color: '#1e232c',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e232c20',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 10,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Urbanist_600SemiBold',
    color: '#1e232c',
  },
  type: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lotacaoTexto: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#1e232c90',
    fontFamily: 'Urbanist_500Medium',
  },
  swipeRemover: {
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '85%',
    borderRadius: 12,
    marginTop: 5,
  },
});
