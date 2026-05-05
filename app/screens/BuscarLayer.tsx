import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Searchbar, Chip } from 'react-native-paper';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  buscarRestaurantesPorTexto,
  buscarRestaurantesProximos,
  RestauranteResumo,
} from '@/src/services/restauranteServices';

interface LocalizacaoCoords {
  latitude: number;
  longitude: number;
}

const categorias = [
  { nome: 'Todos', valor: '' },
  { nome: 'Restaurantes', valor: 'restaurant' },
  { nome: 'Mercados', valor: 'supermarket' },
  { nome: 'Japonesa', valor: 'japanese' },
  { nome: 'Brasileira', valor: 'brazilian' },
  { nome: 'Pizza', valor: 'pizza' },
];

const raios = [1000, 2000, 4000, 7000];

export default function BuscarLayer() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');
  const [resultados, setResultados] = useState<RestauranteResumo[]>([]);
  const [localizacao, setLocalizacao] = useState<LocalizacaoCoords | null>(null);
  const [raioBusca, setRaioBusca] = useState<number>(2000);
  const [avaliacaoMinima, setAvaliacaoMinima] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocalizacao({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  const buscarRestaurantes = useCallback(async () => {
    if (!localizacao) return;

    try {
      setLoading(true);
      const termoCategoria =
        categoriaSelecionada === 'restaurant'
          ? 'restaurante'
          : categoriaSelecionada === 'supermarket'
            ? 'mercado'
            : categoriaSelecionada;
      const termo = [termoCategoria, searchQuery].filter(Boolean).join(' ').trim();
      const data = termo
        ? await buscarRestaurantesPorTexto(termo, localizacao.latitude, localizacao.longitude)
        : await buscarRestaurantesProximos(
            localizacao.latitude,
            localizacao.longitude,
            raioBusca,
            categoriaSelecionada || undefined,
          );

      const filtrado = data
        .filter((r) => r.aberto_agora === true)
        .filter((r) => {
          if (categoriaSelecionada === 'restaurant') {
            return r.tipos?.includes('restaurant') || !r.tipos?.includes('supermarket');
          }
          if (categoriaSelecionada === 'supermarket') {
            return r.tipos?.some((tipo) => tipo.includes('supermarket') || tipo.includes('grocery'));
          }
          return true;
        })
        .filter((r) =>
          !avaliacaoMinima || (r.nota_google && r.nota_google >= parseFloat(avaliacaoMinima)),
        );

      setResultados(filtrado);
    } catch (e) {
      console.error('Erro na busca:', e);
    } finally {
      setLoading(false);
    }
  }, [
    avaliacaoMinima,
    categoriaSelecionada,
    localizacao,
    raioBusca,
    searchQuery,
  ]);

  useEffect(() => {
    buscarRestaurantes();
  }, [buscarRestaurantes]);

  const renderItem = ({ item }: { item: RestauranteResumo }) => {
    const imagem = item.foto_url || 'https://via.placeholder.com/400x200.png?text=Sem+Imagem';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/screens/restaurante',
            params: { placeId: item.google_place_id },
          })
        }
      >
        <Image source={{ uri: imagem }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.nome}>{item.nome}</Text>
          <Text style={styles.tipo}>{item.endereco}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.estrelas}>Nota: {item.nota_google ?? 'N/A'}</Text>
            <Text style={styles.openBadge}>Aberto agora</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#1e232c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Busca</Text>
        <View style={styles.backButtonGhost} />
      </View>

      <Searchbar
        placeholder="Buscar restaurantes e mercados"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <View style={styles.row}>
        {categorias.map((cat) => (
          <Chip
            key={cat.valor}
            selected={categoriaSelecionada === cat.valor}
            onPress={() => setCategoriaSelecionada(categoriaSelecionada === cat.valor ? '' : cat.valor)}
            style={styles.chip}
            mode="outlined"
          >
            {cat.nome}
          </Chip>
        ))}
      </View>

      <View style={styles.row}>
        {raios.map((r) => (
          <Chip
            key={r}
            selected={raioBusca === r}
            onPress={() => setRaioBusca(r)}
            style={styles.chip}
            mode="outlined"
          >
            {r / 1000} km
          </Chip>
        ))}
      </View>

      <TextInput
        placeholder="Avaliação mínima (1-5)"
        keyboardType="numeric"
        value={avaliacaoMinima}
        onChangeText={setAvaliacaoMinima}
        style={styles.input}
        placeholderTextColor="#444"
      />

      {loading && (
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 10 }} />
      )}

      <FlatList
        data={resultados}
        keyExtractor={(item) => item.google_place_id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Nenhum local aberto encontrado.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingTop: 18,
  },
  topBar: {
    minHeight: 48,
    marginHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonGhost: {
    width: 42,
    height: 42,
  },
  headerTitle: {
    color: '#1e232c',
    fontSize: 22,
    fontWeight: '800',
  },
  searchbar: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  chip: {
    margin: 4,
  },
  input: {
    marginHorizontal: 12,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    color: '#000',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 180,
  },
  cardContent: {
    padding: 10,
  },
  nome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0D47A1',
  },
  tipo: {
    fontSize: 14,
    color: '#555',
  },
  estrelas: {
    fontSize: 14,
    color: '#FF8F00',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  openBadge: {
    color: '#2E7D32',
    backgroundColor: '#E9F9EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '700',
    fontSize: 12,
  },
  lista: {
    paddingBottom: 60,
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
});
