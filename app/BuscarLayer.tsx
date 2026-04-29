import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, ActivityIndicator
} from 'react-native';
import { Searchbar, Chip, Button } from 'react-native-paper';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { getNearbySearchUrl, getPlacePhotoUrl } from '@/config/googleApi';

interface LocalizacaoCoords {
  latitude: number;
  longitude: number;
}

interface ResultadoBusca {
  place_id: string;
  name: string;
  rating?: number;
  vicinity: string;
  photos?: { photo_reference: string }[];
}

interface NearbySearchResponse {
  results: ResultadoBusca[];
  next_page_token?: string;
}

const categorias = [
  { nome: 'Todos', valor: '' },
  { nome: 'Japonesa', valor: 'japanese' },
  { nome: 'Brasileira', valor: 'brazilian' },
  { nome: 'Pizza', valor: 'pizza' },
];

const raios = [1000, 2000, 4000, 7000];

export default function BuscarLayer() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [localizacao, setLocalizacao] = useState<LocalizacaoCoords | null>(null);
  const [raioBusca, setRaioBusca] = useState<number>(2000);
  const [avaliacaoMinima, setAvaliacaoMinima] = useState<string>('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
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

  const buscarRestaurantes = useCallback(async (mais = false, pageToken?: string | null) => {
    if (!localizacao) return;
    try {
      setLoading(true);
      const categoria = categoriaSelecionada || 'restaurant';
      const pagToken = mais ? pageToken ?? undefined : undefined;
      const keyword = `${categoria} ${searchQuery}`.trim();

      let url = getNearbySearchUrl(
        localizacao.latitude,
        localizacao.longitude,
        raioBusca,
        'restaurant',
        keyword,
      );
      if (pagToken) {
        url += `&pagetoken=${pagToken}`;
      }

      const res = await axios.get<NearbySearchResponse>(url);
      const filtrado = res.data.results.filter((r) =>
        !avaliacaoMinima || (r.rating && r.rating >= parseFloat(avaliacaoMinima))
      );

      if (mais) {
        setResultados(prev => [...prev, ...filtrado]);
      } else {
        setResultados(filtrado);
      }

      setNextPageToken(res.data.next_page_token || null);
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

  const renderItem = ({ item }: { item: ResultadoBusca }) => {
    const imagem = item.photos?.[0]?.photo_reference
      ? getPlacePhotoUrl(item.photos[0].photo_reference)
      : 'https://via.placeholder.com/400x200.png?text=Sem+Imagem';

    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/restaurante?placeId=${item.place_id}`)}>
        <Image source={{ uri: imagem }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.nome}>{item.name}</Text>
          <Text style={styles.tipo}>{item.vicinity}</Text>
          <Text style={styles.estrelas}>⭐ {item.rating ?? 'N/A'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Buscar restaurantes"
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
        keyExtractor={(item) => item.place_id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Nenhum restaurante encontrado.</Text> : null
        }
        ListFooterComponent={
          nextPageToken ? (
            <Button mode="contained" onPress={() => buscarRestaurantes(true, nextPageToken)} style={styles.botao}>
              Carregar mais
            </Button>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingTop: 8,
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
    marginTop: 4,
  },
  lista: {
    paddingBottom: 60,
  },
  empty: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  botao: {
    marginHorizontal: 50,
    marginTop: 16,
    marginBottom: 30,
  },
});
