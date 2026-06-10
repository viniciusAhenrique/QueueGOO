import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Searchbar } from 'react-native-paper';

import {
  buscarRestaurantesPorTexto,
  buscarRestaurantesProximos,
  RestauranteResumo,
} from '@/src/services/restauranteServices';
import {
  consultarCardapioQmesa,
  extrairLinkReservaQmesa,
  listarLotacoesQmesa,
  listarMetricasQmesa,
  QmesaMetrica,
} from '@/src/services/qmesaPublicApi';

interface LocalizacaoCoords {
  latitude: number;
  longitude: number;
}

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

const categorias = [
  { nome: 'Todos', valor: '' },
  { nome: 'Restaurantes', valor: 'restaurant' },
  { nome: 'Burger', valor: 'burger' },
  { nome: 'Cafe', valor: 'cafe' },
  { nome: 'Bar', valor: 'bar' },
  { nome: 'Padaria', valor: 'bakery' },
  { nome: 'Japonesa', valor: 'japanese' },
  { nome: 'Brasileira', valor: 'brazilian' },
  { nome: 'Italiana', valor: 'italian' },
  { nome: 'Mexicana', valor: 'mexican' },
  { nome: 'Vegetariana', valor: 'vegetarian' },
  { nome: 'Pizza', valor: 'pizza' },
  { nome: 'Mercados', valor: 'supermarket' },
];

const raios = [1000, 2000, 4000, 7000, 12000, 20000, 50000];

const restricoesAlimentares = [
  {
    nome: 'Sem gluten',
    valor: 'sem-gluten',
    termoBusca: 'sem gluten gluten free',
    termosBusca: ['sem gluten', 'gluten free', 'sem glúten'],
    palavras: ['sem gluten', 'gluten free', 'gluten-free', 'nao contem gluten'],
  },
  {
    nome: 'Sem lactose',
    valor: 'sem-lactose',
    termoBusca: 'sem lactose lactose free',
    termosBusca: ['sem lactose', 'lactose free', 'zero lactose'],
    palavras: ['sem lactose', 'lactose free', 'zero lactose', 'nao contem lactose'],
  },
  {
    nome: 'Vegano',
    valor: 'vegano',
    termoBusca: 'vegano vegan',
    termosBusca: ['vegano', 'vegan', 'plant based'],
    palavras: ['vegano', 'vegan', 'plant based', 'plant-based'],
  },
  {
    nome: 'Vegetariano',
    valor: 'vegetariano',
    termoBusca: 'vegetariano vegetarian',
    termosBusca: ['vegetariano', 'vegetarian'],
    palavras: ['vegetariano', 'vegetarian'],
  },
];

function ehMercado(restaurante: RestauranteResumo) {
  return restaurante.tipos?.some((tipo) =>
    tipo.includes('supermarket') || tipo.includes('grocery') || tipo.includes('commercial.food'),
  );
}

function ehRestaurante(restaurante: RestauranteResumo) {
  return !ehMercado(restaurante);
}

function textoNormalizado(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cardapioAtendeRestricao(texto: string, restricao: string) {
  if (!restricao) return true;
  const filtro = restricoesAlimentares.find((item) => item.valor === restricao);
  if (!filtro) return true;

  const textoBase = textoNormalizado(texto);
  return filtro.palavras.some((palavra) => textoBase.includes(textoNormalizado(palavra)));
}

function deduplicarRestaurantes(restaurantes: RestauranteResumo[]) {
  const vistos = new Set<string>();
  return restaurantes.filter((restaurante) => {
    const chave = restaurante.google_place_id || textoNormalizado(`${restaurante.nome}-${restaurante.latitude}-${restaurante.longitude}`);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

async function buscarRestaurantesExternosComRestricao(
  termoBase: string,
  restricao: (typeof restricoesAlimentares)[number] | undefined,
  localizacao: LocalizacaoCoords,
  raioBusca: number,
) {
  if (!restricao) {
    return termoBase
      ? buscarRestaurantesPorTexto(termoBase, localizacao.latitude, localizacao.longitude, raioBusca)
      : buscarRestaurantesProximos(localizacao.latitude, localizacao.longitude, raioBusca);
  }

  const termos = restricao.termosBusca.map((termoRestricao) =>
    [termoBase, termoRestricao].filter(Boolean).join(' ').trim(),
  );

  const resultados = await Promise.all(
    termos.map((termo) => buscarRestaurantesPorTexto(termo, localizacao.latitude, localizacao.longitude, raioBusca).catch(() => [])),
  );

  return deduplicarRestaurantes(resultados.flat());
}

function calcularDistanciaMetros(origem: LocalizacaoCoords, destino: LocalizacaoCoords) {
  const raioTerra = 6371000;
  const lat1 = (origem.latitude * Math.PI) / 180;
  const lat2 = (destino.latitude * Math.PI) / 180;
  const deltaLat = ((destino.latitude - origem.latitude) * Math.PI) / 180;
  const deltaLng = ((destino.longitude - origem.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return raioTerra * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function BuscarLayer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [resultados, setResultados] = useState<RestauranteResumo[]>([]);
  const [localizacao, setLocalizacao] = useState<LocalizacaoCoords | null>(null);
  const [raioBusca, setRaioBusca] = useState(2000);
  const [avaliacaoMinima, setAvaliacaoMinima] = useState('');
  const [restricaoSelecionada, setRestricaoSelecionada] = useState('');
  const [loading, setLoading] = useState(false);
  const [buscaFeita, setBuscaFeita] = useState(false);

  const router = useRouter();

  const buscarQmesa = useCallback(async (termo: string): Promise<RestauranteResumo[]> => {
    try {
      let metricas: QmesaMetrica[] = [];
      try {
        metricas = await listarMetricasQmesa();
      } catch (error) {
        console.warn('Recurso metricas indisponivel na busca, tentando lotacao:', error);
        metricas = await listarLotacoesQmesa() as QmesaMetrica[];
      }

      const termoNormalizado = textoNormalizado(termo);
      const comCoordenadas = metricas.filter(
        (item): item is QmesaMetrica & { latitude: number; longitude: number } =>
          typeof item.latitude === 'number' && typeof item.longitude === 'number',
      );
      const porTexto = comCoordenadas.filter((item) => {
        if (!termoNormalizado) return true;
        return textoNormalizado(item.restaurante_nome || '').includes(termoNormalizado);
      });

      const porRestricao = restricaoSelecionada
        ? (await Promise.all(
            porTexto.map(async (item) => {
              const cardapio = await consultarCardapioQmesa(item.restaurante_id).catch(() => []);
              const textoCardapio = cardapio
                .map((cardapioItem) =>
                  [
                    cardapioItem.nome,
                    cardapioItem.descricao,
                    cardapioItem.categoria,
                  ].filter(Boolean).join(' '),
                )
                .join(' ');

              if (!textoCardapio.trim()) return item;
              return cardapioAtendeRestricao(textoCardapio, restricaoSelecionada) ? item : null;
            }),
          )).filter((item): item is QmesaMetrica & { latitude: number; longitude: number } => Boolean(item))
        : porTexto;

      if (__DEV__) {
        console.info('[Qmesa API] Filtro na tela de busca:', {
          recebidos: metricas.length,
          comCoordenadas: comCoordenadas.length,
          exibidosSemFiltroDeRaio: porRestricao.length,
          termo,
          restricaoSelecionada,
        });
      }

      return porRestricao.map((item) => {
        const reservaUrlQmesa = extrairLinkReservaQmesa(item);
        if (__DEV__ && reservaUrlQmesa) {
          console.info('[Qmesa API] Link de reserva recebido na busca:', {
            restaurante_id: item.restaurante_id,
            restaurante_nome: item.restaurante_nome,
          });
        }

        return {
          google_place_id: item.restaurante_id,
          nome: item.restaurante_nome,
          endereco: 'Parceiro Qmesa com dados ao vivo',
          latitude: item.latitude,
          longitude: item.longitude,
          foto_url: null,
          aberto_agora: item.aberto_agora ?? true,
          tipos: ['restaurant', 'qmesa'],
          distancia_metros: localizacao
            ? Math.round(
                calcularDistanciaMetros(localizacao, {
                  latitude: item.latitude,
                  longitude: item.longitude,
                }),
              )
            : undefined,
          origem_qmesa: true,
          reserva_url_qmesa: reservaUrlQmesa,
          movimento_atual: item.movimento_atual || null,
          recomendacao_visita: item.recomendacao_visita || null,
          mesas_livres: item.mesas_livres ?? null,
          capacidade_total: item.capacidade_total ?? null,
          percentual_ocupacao: item.percentual_ocupacao ?? null,
        };
      });
    } catch (error) {
      console.warn('API Qmesa indisponivel na busca:', error);
      return [];
    }
  }, [localizacao, restricaoSelecionada]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocalizacao({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  const buscarRestaurantes = useCallback(async () => {
    if (!localizacao) return;

    try {
      setLoading(true);
      const termoCategoria =
        categoriaSelecionada === 'supermarket'
          ? 'mercado'
          : categoriaSelecionada === 'restaurant' || !categoriaSelecionada
            ? ''
            : categoriaSelecionada;
      const restricao = restricoesAlimentares.find((item) => item.valor === restricaoSelecionada);
      const termo = [termoCategoria, searchQuery].filter(Boolean).join(' ').trim();
      const [data, restaurantesQmesa] = await Promise.all([
        buscarRestaurantesExternosComRestricao(termo, restricao, localizacao, raioBusca),
        categoriaSelecionada === 'supermarket' ? Promise.resolve([]) : buscarQmesa(searchQuery),
      ]);

      const externosFiltrados = data
        .filter((r) => r.aberto_agora !== false)
        .filter((r) => {
          if (categoriaSelecionada === 'supermarket') return ehMercado(r);
          return ehRestaurante(r);
        })
        .filter((r) =>
          !avaliacaoMinima || (r.nota_google && r.nota_google >= parseFloat(avaliacaoMinima)),
        );

      const idsExternos = new Set(externosFiltrados.map((r) => r.google_place_id));
      const qmesaSemDuplicar = restaurantesQmesa.filter((r) => !idsExternos.has(r.google_place_id));

      setResultados([...qmesaSemDuplicar, ...externosFiltrados]);
      setBuscaFeita(true);
    } catch (e) {
      console.error('Erro na busca:', e);
      setResultados([]);
      setBuscaFeita(true);
    } finally {
      setLoading(false);
    }
  }, [
    avaliacaoMinima,
    buscarQmesa,
    categoriaSelecionada,
    localizacao,
    raioBusca,
    restricaoSelecionada,
    searchQuery,
  ]);

  const podeExpandirRaio = useMemo(() => raioBusca < raios[raios.length - 1], [raioBusca]);

  const expandirRaio = () => {
    const proximoRaio = raios.find((raio) => raio > raioBusca) || raios[raios.length - 1];
    setRaioBusca(proximoRaio);
  };

  useEffect(() => {
    buscarRestaurantes();
  }, [buscarRestaurantes]);

  const verNoMapa = () => {
    const termoCategoria =
      categoriaSelecionada === 'supermarket'
        ? 'mercado'
        : categoriaSelecionada === 'restaurant'
          ? ''
          : categoriaSelecionada;
    const restricao = restricoesAlimentares.find((item) => item.valor === restricaoSelecionada);
    const termoBusca = [termoCategoria, searchQuery, restricao?.termoBusca].filter(Boolean).join(' ').trim();

    router.push({
      pathname: '/screens/mapa',
      params: {
        tipoCulinaria: termoBusca || undefined,
        termoBusca: termoBusca || 'Restaurantes',
        raio: String(raioBusca),
      },
    });
  };

  const renderItem = ({ item }: { item: RestauranteResumo }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/screens/restaurante',
          params: item.origem_qmesa
            ? {
                placeId: item.google_place_id,
                origemQmesa: '1',
                nome: item.nome,
                tipo: 'Restaurante parceiro Qmesa',
                movimentoAtual: item.movimento_atual || undefined,
                recomendacaoVisita: item.recomendacao_visita || undefined,
                mesasLivres: item.mesas_livres?.toString(),
                capacidadeTotal: item.capacidade_total?.toString(),
                reservaUrlQmesa: item.reserva_url_qmesa || undefined,
              }
            : { placeId: item.google_place_id },
        })
      }
    >
      {item.foto_url ? (
        <Image source={{ uri: item.foto_url }} style={styles.cardImage} />
      ) : (
        <View style={styles.cardImageFallback}>
          <MaterialIcons
            name={item.origem_qmesa ? 'verified' : ehMercado(item) ? 'storefront' : 'restaurant'}
            size={34}
            color={item.origem_qmesa ? '#FF8F00' : BLUE_DARK}
          />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.nome} numberOfLines={2}>{item.nome}</Text>
        <Text style={styles.tipo} numberOfLines={2}>{item.endereco || 'Endereco nao informado'}</Text>
        {item.origem_qmesa && (
          <View style={styles.qmesaBadge}>
            <MaterialIcons name="verified" size={14} color="#FFFFFF" />
            <Text style={styles.qmesaBadgeText}>Qmesa ao vivo</Text>
          </View>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.distance}>
            {item.distancia_metros
              ? `${(item.distancia_metros / 1000).toFixed(1)} km`
              : item.origem_qmesa
                ? 'Qmesa'
                : 'Perto de voce'}
          </Text>
          <Text style={styles.openBadge}>
            {item.aberto_agora === true ? 'Aberto agora' : 'Horario nao informado'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Busca</Text>
          <Text style={styles.headerSubtitle}>Qmesa, restaurantes e lugares</Text>
        </View>
        <View style={styles.iconGhost} />
      </View>

      <View style={styles.controls}>
        <Searchbar
          placeholder="Buscar restaurante, comida ou lugar"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />

        <Text style={styles.controlLabel}>Categoria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {categorias.map((cat) => {
            const ativo = categoriaSelecionada === cat.valor;
            return (
              <TouchableOpacity
                key={cat.valor || 'todos'}
                style={[styles.filterChip, ativo && styles.filterChipActive]}
                onPress={() => setCategoriaSelecionada(ativo ? '' : cat.valor)}
              >
                <Text style={[styles.filterChipText, ativo && styles.filterChipTextActive]}>{cat.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.controlLabel}>Restricao alimentar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {restricoesAlimentares.map((restricao) => {
            const ativo = restricaoSelecionada === restricao.valor;
            return (
              <TouchableOpacity
                key={restricao.valor}
                style={[styles.dietChip, ativo && styles.dietChipActive]}
                onPress={() => setRestricaoSelecionada(ativo ? '' : restricao.valor)}
              >
                <MaterialIcons
                  name={restricao.valor === 'sem-gluten' ? 'no-food' : 'restaurant-menu'}
                  size={15}
                  color={ativo ? '#FFFFFF' : '#2E7D32'}
                />
                <Text style={[styles.dietChipText, ativo && styles.dietChipTextActive]}>
                  {restricao.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.controlLabel}>Raio</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {raios.map((r) => {
            const ativo = raioBusca === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.radiusChip, ativo && styles.radiusChipActive]}
                onPress={() => setRaioBusca(r)}
              >
                <Text style={[styles.radiusChipText, ativo && styles.radiusChipTextActive]}>{r / 1000} km</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.ratingRow}>
          <MaterialIcons name="star" size={18} color="#FF8F00" />
          <TextInput
            placeholder="Nota minima"
            keyboardType="numeric"
            value={avaliacaoMinima}
            onChangeText={setAvaliacaoMinima}
            style={styles.input}
            placeholderTextColor="#667085"
          />
        </View>
      </View>

      <View style={styles.resultBar}>
        <Text style={styles.resultText}>
          {loading ? 'Buscando...' : `${resultados.length} locais encontrados`}
        </Text>
        <TouchableOpacity style={styles.mapFilterButton} onPress={verNoMapa}>
          <MaterialIcons name="map" size={18} color="#FFFFFF" />
          <Text style={styles.mapFilterButtonText}>Mapa</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color={BLUE_DARK} style={styles.loader} />}

      <FlatList
        data={resultados}
        keyExtractor={(item) => item.google_place_id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          !loading && buscaFeita ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={32} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Nenhum restaurante encontrado nesta busca.</Text>
              {podeExpandirRaio ? (
                <TouchableOpacity style={styles.expandButton} onPress={expandirRaio}>
                  <MaterialIcons name="travel-explore" size={18} color="#FFFFFF" />
                  <Text style={styles.expandButtonText}>Buscar em um raio maior</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.empty}>Tente outra categoria ou termo de busca.</Text>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD', paddingTop: 18 },
  topBar: {
    minHeight: 48,
    marginHorizontal: 12,
    marginBottom: 8,
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
  iconGhost: { width: 42, height: 42 },
  headerText: { alignItems: 'center' },
  headerTitle: { color: INK, fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: '#4B6475', fontSize: 12, fontWeight: '700', marginTop: 1 },
  controls: {
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 10,
  },
  searchbar: {
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#F8FCFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  searchInput: { fontSize: 14 },
  controlLabel: { color: '#344054', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 8, paddingRight: 8 },
  filterChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: { backgroundColor: BLUE_DARK, borderColor: BLUE_DARK },
  filterChipText: { color: BLUE_DARK, fontSize: 12, fontWeight: '800' },
  filterChipTextActive: { color: '#FFFFFF' },
  dietChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7D7B8',
    paddingHorizontal: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2FFF6',
    flexDirection: 'row',
    gap: 6,
  },
  dietChipActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  dietChipText: { color: '#2E7D32', fontSize: 12, fontWeight: '800' },
  dietChipTextActive: { color: '#FFFFFF' },
  radiusChip: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  radiusChipText: { color: BLUE_DARK, fontSize: 12, fontWeight: '800' },
  radiusChipTextActive: { color: '#FFFFFF' },
  ratingRow: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E3F2FD',
    backgroundColor: '#F8FCFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, color: INK, fontSize: 14, paddingVertical: 8 },
  resultBar: {
    marginHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultText: { flex: 1, color: '#344054', fontWeight: '800' },
  mapFilterButton: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  mapFilterButtonText: { color: '#FFFFFF', fontWeight: '800' },
  loader: { marginTop: 10 },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 142 },
  cardImageFallback: {
    width: '100%',
    height: 142,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { padding: 12 },
  nome: { fontSize: 17, fontWeight: '800', color: BLUE_DARK },
  tipo: { fontSize: 13, color: '#555', marginTop: 4, lineHeight: 18 },
  qmesaBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#FF8F00',
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  qmesaBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  distance: { fontSize: 13, color: '#FF8F00', fontWeight: '800' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
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
  lista: { paddingBottom: 60 },
  empty: { textAlign: 'center', marginTop: 20, color: '#666' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyTitle: { color: INK, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  expandButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  expandButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
