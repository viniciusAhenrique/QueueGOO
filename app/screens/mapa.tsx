//mapa.tsx mudará para python posteriormente.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Text,
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/firebaseconfig';
import BalaoRestaurante from '../components/modalRestaurante';
import {
  buscarLotacaoAtual,
  buscarRestaurantesPorTexto,
  buscarRestaurantesProximos,
} from '@/src/services/restauranteServices';
import {
  consultarCardapioQmesa,
  extrairLinkReservaQmesa,
  listarLotacoesQmesa,
  listarMetricasQmesa,
  QmesaMetrica,
} from '@/src/services/qmesaPublicApi';

const { width } = Dimensions.get('window');
const menuWidth = width * 0.7;

const mapStyleLimpo = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
];

function estaAberto(item: { aberto_agora?: boolean }) {
  return item.aberto_agora !== false;
}

function calcularDistanciaMetros(origem: Coordenadas, destino: Coordenadas) {
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

const PIN_COLORS = {
  desconhecida: '#8E8E93',
  baixa: '#34C759',
  media: '#FFB020',
  alta: '#FF3B30',
};

// Tipos adicionados para evitar inferência `never`/`any` nos estados.
// Alteracao recente: Coordinates foi renomeado para Coordenadas para padronizar em portugues.
type Coordenadas = {
  latitude: number;
  longitude: number;
};

const MAP_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Restaurantes', value: 'restaurante' },
  { label: 'Pizza', value: 'pizza' },
  { label: 'Burger', value: 'burger' },
  { label: 'Sushi', value: 'sushi' },
  { label: 'Café', value: 'cafe' },
  { label: 'Bar', value: 'bar' },
  { label: 'Padaria', value: 'padaria' },
  { label: 'Vegetariano', value: 'vegetarian' },
  { label: 'Sem gluten', value: 'diet:sem-gluten' },
  { label: 'Sem lactose', value: 'diet:sem-lactose' },
  { label: 'Vegano', value: 'diet:vegano' },
  { label: 'Mercados', value: 'mercado' },
];

const DIETARY_FILTERS = [
  {
    valor: 'diet:sem-gluten',
    termoBusca: 'sem gluten gluten free',
    termosBusca: ['sem gluten', 'gluten free', 'sem glúten'],
    palavras: ['sem gluten', 'gluten free', 'gluten-free', 'nao contem gluten'],
  },
  {
    valor: 'diet:sem-lactose',
    termoBusca: 'sem lactose lactose free',
    termosBusca: ['sem lactose', 'lactose free', 'zero lactose'],
    palavras: ['sem lactose', 'lactose free', 'zero lactose', 'nao contem lactose'],
  },
  {
    valor: 'diet:vegano',
    termoBusca: 'vegano vegan',
    termosBusca: ['vegano', 'vegan', 'plant based'],
    palavras: ['vegano', 'vegan', 'plant based', 'plant-based'],
  },
  {
    valor: 'vegetarian',
    termoBusca: 'vegetariano vegetarian',
    termosBusca: ['vegetariano', 'vegetarian'],
    palavras: ['vegetariano', 'vegetarian'],
  },
];

const MAP_RAIOS = [1000, 2000, 4000, 7000, 12000, 20000, 50000];

const COORDENADAS_TESTE_CURITIBA: Coordenadas = {
  latitude: -25.4284,
  longitude: -49.2733,
};

const coordenadasDevTeste =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_TEST_LOCATION === 'curitiba'
    ? COORDENADAS_TESTE_CURITIBA
    : null;

type Restaurante = {
  id: string;
  nome: string;
  tipo: string;
  latitude: number;
  longitude: number;
  foto: string | null;
  lotacao: number | null;
  origemQmesa?: boolean;
  movimentoAtual?: string | null;
  recomendacaoVisita?: string | null;
  mesasLivres?: number | null;
  capacidadeTotal?: number | null;
  reservaUrlQmesa?: string | null;
};

function calcularLotacaoPercentual(item: {
  percentual_ocupacao?: number | null;
  mesas_ocupadas?: number | null;
  mesas_totais?: number | null;
  ocupantes_atuais?: number | null;
  capacidade_total?: number | null;
}) {
  if (typeof item.percentual_ocupacao === 'number') {
    return Math.max(0, Math.min(100, Math.round(item.percentual_ocupacao)));
  }

  if (
    typeof item.mesas_ocupadas === 'number' &&
    typeof item.mesas_totais === 'number' &&
    item.mesas_totais > 0
  ) {
    return Math.max(0, Math.min(100, Math.round((item.mesas_ocupadas / item.mesas_totais) * 100)));
  }

  if (
    typeof item.ocupantes_atuais === 'number' &&
    typeof item.capacidade_total === 'number' &&
    item.capacidade_total > 0
  ) {
    return Math.max(0, Math.min(100, Math.round((item.ocupantes_atuais / item.capacidade_total) * 100)));
  }

  return null;
}

function itemEhMercado(item: { tipos?: string[] }) {
  return item.tipos?.some((tipo) =>
    tipo.includes('supermarket') || tipo.includes('grocery') || tipo.includes('commercial.food'),
  );
}

function textoNormalizado(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function obterFiltroDieta(filtro: string) {
  return DIETARY_FILTERS.find((item) => item.valor === filtro) || null;
}

function obterRotuloFiltro(filtro: string) {
  return MAP_FILTERS.find((item) => item.value === filtro)?.label || filtro;
}

function cardapioAtendeFiltroDieta(texto: string, filtro: string) {
  const filtroDieta = obterFiltroDieta(filtro);
  if (!filtroDieta) return true;

  const textoBase = textoNormalizado(texto);
  return filtroDieta.palavras.some((palavra) => textoBase.includes(textoNormalizado(palavra)));
}

function deduplicarRestaurantesMapa(restaurantes: Restaurante[]) {
  const vistos = new Set<string>();
  return restaurantes.filter((restaurante) => {
    const chave = restaurante.id || textoNormalizado(`${restaurante.nome}-${restaurante.latitude}-${restaurante.longitude}`);
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export default function MapaComTudo() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Estado com união explícita para coordenadas ainda não carregadas.
  // Referencia atualizada para o novo nome do tipo Coordenadas.
  const [userLocation, setUserLocation] = useState<Coordenadas | null>(null);
  const [lugares, setLugares] = useState<Restaurante[]>([]);
  const [lugarSelecionado, setLugarSelecionado] = useState<Restaurante | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [notificacoesPendentes, setNotificacoesPendentes] = useState(0);
  const [loading, setLoading] = useState(false);
  const slideAnim = useState(new Animated.Value(-menuWidth))[0];
  // Ref tipada para liberar `animateToRegion` com segurança.
  const mapRef = useRef<MapView | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{
    tipoCulinaria?: string;
    termoBusca?: string;
    raio?: string;
    rolePlaceId?: string;
    roleNome?: string;
    roleOrigemQmesa?: string;
    roleLatitude?: string;
    roleLongitude?: string;
    roleFotoUrl?: string;
    roleReservaUrlQmesa?: string;
  }>();
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const nomeUsuario = authUser?.displayName || authUser?.email || 'Usuário';
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filtroMapa, setFiltroMapa] = useState(
    typeof params.tipoCulinaria === 'string' ? params.tipoCulinaria : '',
  );
  const [raioMapa, setRaioMapa] = useState(() => {
    const recebido = Number(params.raio);
    return Number.isFinite(recebido) && recebido > 0 ? recebido : 1500;
  });
  const filtroMapaRef = useRef(filtroMapa);
  const raioMapaRef = useRef(raioMapa);
  // Começa como `null` até existir uma posição anterior para comparação de distância.
  // Referencia atualizada para o novo nome do tipo Coordenadas.
  const ultimaPosicaoBuscada = useRef<Coordenadas | null>(null);

  const animarMenu = (abrir: boolean) => {
    Animated.timing(slideAnim, {
      toValue: abrir ? 0 : -menuWidth,
      duration: 250,
      useNativeDriver: false,
    }).start(() => setMenuOpen(abrir));
  };

  const abrirMenu = () => animarMenu(true);
  const fecharMenu = () => animarMenu(false);

  const fecharApp = () => {
    setMenuOpen(false);
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }

    Alert.alert('Sessao mantida', 'Feche o app pelo seletor do sistema. Sua conta continua conectada.');
  };

  const centralizarLocal = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const irParaBuscar = () => router.push('/screens/BuscarLayer');
  const irParaFavoritos = () => router.push('/screens/favoritos');
  const irParaReservas = () => {
    setMenuOpen(false);
    router.push('/screens/reservas' as never);
  };
  const irParaSocial = () => {
    setMenuOpen(false);
    router.push('/screens/social' as never);
  };
  const irParaRole = () => {
    setMenuOpen(false);
    router.push('/screens/role' as never);
  };
  const irParaFeed = () => {
    setMenuOpen(false);
    router.push('/screens/feed' as never);
  };

  const moverMapaPara = (coordenadas: Coordenadas) => {
    mapRef.current?.animateToRegion({
      latitude: coordenadas.latitude,
      longitude: coordenadas.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };
  const irParaNotificacoes = () => {
    setMenuOpen(false);
    router.push('/screens/notificacoes' as never);
  };
  const irParaPerfil = () => {
    setMenuOpen(false);
    router.push('/screens/perfil');
  };

  const getPinColor = (lot: number | null) => {
    if (lot === null) return PIN_COLORS.desconhecida;
    if (lot >= 75) return PIN_COLORS.alta;
    if (lot >= 40) return PIN_COLORS.media;
    return PIN_COLORS.baixa;
  };

  const montarRestauranteDoRole = (): Restaurante | null => {
    if (!params.rolePlaceId || !params.roleLatitude || !params.roleLongitude) return null;

    const latitude = Number(params.roleLatitude);
    const longitude = Number(params.roleLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      id: params.rolePlaceId,
      nome: params.roleNome || 'Restaurante do role',
      tipo: params.roleOrigemQmesa === '1' ? 'Parceiro Qmesa' : 'Restaurante',
      latitude,
      longitude,
      foto: params.roleFotoUrl || null,
      lotacao: null,
      origemQmesa: params.roleOrigemQmesa === '1',
      reservaUrlQmesa: params.roleReservaUrlQmesa || null,
    };
  };

  const handleMapDrag = () => {
    setLugarSelecionado(null);
  };

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  useEffect(() => {
    if (!authUser) {
      setNotificacoesPendentes(0);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'usuarios', authUser.uid, 'notificacoes'),
      (snapshot) => {
        setNotificacoesPendentes(
          snapshot.docs.filter((documento) => !documento.data().lida).length,
        );
      },
      (error) => {
        console.error('Erro ao carregar notificacoes:', error);
        setNotificacoesPendentes(0);
      },
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    const interval = setInterval(() => {
      atualizarLotacoes();
    }, 120000);

    return () => clearInterval(interval);
  // atualizarLotacoes usa o snapshot atual de `lugares`; incluir a funcao recriaria o intervalo a cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, lugares]);

  useEffect(() => {
    filtroMapaRef.current = filtroMapa;
    raioMapaRef.current = raioMapa;
  }, [filtroMapa, raioMapa]);

  useEffect(() => {
    if (typeof params.tipoCulinaria === 'string') {
      setFiltroMapa(params.tipoCulinaria);
    }
    const recebido = Number(params.raio);
    if (Number.isFinite(recebido) && recebido > 0) {
      setRaioMapa(recebido);
    }
  }, [params.raio, params.tipoCulinaria]);

  useEffect(() => {
    if (!userLocation) return;
    buscarGooglePlaces(userLocation.latitude, userLocation.longitude);
  // buscarGooglePlaces le filtros via refs para evitar chamadas duplicadas durante digitacao/mudanca de raio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroMapa, raioMapa, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    const restauranteRole = montarRestauranteDoRole();
    if (!restauranteRole) return;

    setLugares((atuais) => {
      if (atuais.some((item) => item.id === restauranteRole.id)) return atuais;
      return [restauranteRole, ...atuais];
    });
    setLugarSelecionado((atual) => atual?.id === restauranteRole.id ? atual : restauranteRole);
    moverMapaPara({
      latitude: restauranteRole.latitude,
      longitude: restauranteRole.longitude,
    });
  // montarRestauranteDoRole deriva apenas dos parametros listados abaixo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.roleLatitude,
    params.roleLongitude,
    params.roleFotoUrl,
    params.roleNome,
    params.roleOrigemQmesa,
    params.rolePlaceId,
    params.roleReservaUrlQmesa,
  ]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Localizacao desativada',
          'Permita o acesso a localizacao para ver restaurantes proximos de voce.',
        );
        if (coordenadasDevTeste) {
          setUserLocation(coordenadasDevTeste);
          ultimaPosicaoBuscada.current = coordenadasDevTeste;
          moverMapaPara(coordenadasDevTeste);
          buscarGooglePlaces(coordenadasDevTeste.latitude, coordenadasDevTeste.longitude);
        }
        return;
      }

      let initialCoords: Coordenadas | null = null;
      try {
        const lastKnownLocation = await Location.getLastKnownPositionAsync({
          maxAge: 120000,
          requiredAccuracy: 500,
        });
        const location =
          lastKnownLocation ||
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        // Referencia atualizada para o novo nome do tipo Coordenadas.
        initialCoords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      } catch (error) {
        console.warn('Localizacao indisponivel:', error);
      }

      if (!initialCoords && coordenadasDevTeste) {
        initialCoords = coordenadasDevTeste;
      }

      if (!initialCoords) return;

      setUserLocation(initialCoords);
      ultimaPosicaoBuscada.current = initialCoords;
      moverMapaPara(initialCoords);
      buscarGooglePlaces(initialCoords.latitude, initialCoords.longitude);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 500,
          timeInterval: 60000,
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          setUserLocation({ latitude, longitude });

          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(() => {
            const ultima = ultimaPosicaoBuscada.current;
            // Primeira execução do watcher: busca imediatamente e inicializa referência.
            if (!ultima) {
              buscarGooglePlaces(latitude, longitude);
              ultimaPosicaoBuscada.current = { latitude, longitude };
              return;
            }

            const distancia = calcularDistanciaMetros(ultima, { latitude, longitude });
            if (distancia > 500) {
              buscarGooglePlaces(latitude, longitude);
              ultimaPosicaoBuscada.current = { latitude, longitude };
            }
          }, 3000);
        },
      );
    })();

    return () => {
      locationSubscription.current?.remove();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  // Watcher de localizacao deve ser registrado uma unica vez; filtros dinamicos sao lidos via refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarGooglePlaces = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const filtro = filtroMapaRef.current.trim();
      const raioAtual = raioMapaRef.current;
      const filtroDieta = obterFiltroDieta(filtro);
      const restaurantesQmesa = await buscarRestaurantesQmesa(latitude, longitude, raioAtual, filtro);
      const buscasExternas = filtroDieta
        ? await Promise.all(
            filtroDieta.termosBusca.map((termo) =>
              buscarRestaurantesPorTexto(termo, latitude, longitude, raioAtual).catch(() => []),
            ),
          )
        : null;
      const dataInicial = buscasExternas
        ? buscasExternas.flat()
        : filtro
        ? await buscarRestaurantesPorTexto(filtro, latitude, longitude, raioAtual)
        : await buscarRestaurantesProximos(latitude, longitude, raioAtual);
      let data = dataInicial;

      const podeUsarAreaDevTeste =
        coordenadasDevTeste &&
        calcularDistanciaMetros(
          { latitude, longitude },
          coordenadasDevTeste,
        ) > 3000;

      if (data.length === 0 && podeUsarAreaDevTeste) {
        data = await buscarRestaurantesProximos(
          coordenadasDevTeste.latitude,
          coordenadasDevTeste.longitude,
          Math.max(raioAtual, 3000),
          (filtroDieta?.termosBusca[0] || filtro) || undefined,
        );
        moverMapaPara(coordenadasDevTeste);
      }

      const restaurantesExternos: Restaurante[] = data
        .filter((item) => item.google_place_id && item.latitude !== undefined && item.longitude !== undefined)
        .filter(estaAberto)
        .filter((item) => !item.nota_google || item.nota_google >= 3.5)
        .filter((item) => (filtro === 'mercado' ? itemEhMercado(item) : !itemEhMercado(item)))
        .map((item) => ({
          id: item.google_place_id,
          nome: item.nome,
          tipo: itemEhMercado(item) ? 'Mercado' : 'Restaurante',
          latitude: item.latitude,
          longitude: item.longitude,
          foto: item.foto_url || null,
          lotacao: null,
        }));

      const restaurantesFiltradosBase = deduplicarRestaurantesMapa([
        ...restaurantesQmesa,
        ...restaurantesExternos,
      ]);

      const restaurantesComLotacao = await Promise.all(
        restaurantesFiltradosBase.map(async (restaurante) => ({
          ...restaurante,
          lotacao:
            restaurante.lotacao !== null ? restaurante.lotacao : await buscarLotacao(restaurante.id),
        })),
      );

      const totalComLotacao = restaurantesComLotacao.filter(
        (restaurante) => restaurante.lotacao !== null,
      ).length;
      console.info(
        `Lotacao carregada para ${totalComLotacao}/${restaurantesComLotacao.length} restaurantes.`,
      );

      const restauranteRole = montarRestauranteDoRole();
      const restaurantesComRole =
        restauranteRole && !restaurantesComLotacao.some((item) => item.id === restauranteRole.id)
          ? [restauranteRole, ...restaurantesComLotacao]
          : restaurantesComLotacao;

      setLugares(restaurantesComRole);
    } catch (e) {
      console.error('Erro ao buscar lugares:', e);
    } finally {
      setLoading(false);
    }
  };

  const buscarRestaurantesQmesa = async (
    latitude: number,
    longitude: number,
    raio: number,
    filtro: string,
  ): Promise<Restaurante[]> => {
    try {
      let metricas: QmesaMetrica[] = [];
      try {
        metricas = await listarMetricasQmesa();
      } catch (error) {
        console.warn('Recurso metricas indisponivel, tentando lotacao:', error);
        metricas = await listarLotacoesQmesa() as QmesaMetrica[];
      }
      const termo = textoNormalizado(filtro);
      const comCoordenadas = metricas.filter(
        (item): item is QmesaMetrica & { latitude: number; longitude: number } =>
          typeof item.latitude === 'number' && typeof item.longitude === 'number',
      );
      const abertos = comCoordenadas.filter((item) => item.aberto_agora !== false);
      const filtroDieta = obterFiltroDieta(filtro);
      const porTexto = abertos.filter((item) => {
        if (!termo || filtro === 'restaurante' || filtroDieta) return true;
        return textoNormalizado(item.restaurante_nome || '').includes(termo);
      });
      const porDieta = filtroDieta
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
              return cardapioAtendeFiltroDieta(textoCardapio, filtro) ? item : null;
            }),
          )).filter((item): item is QmesaMetrica & { latitude: number; longitude: number } => Boolean(item))
        : porTexto;

      if (__DEV__) {
        console.info('[Qmesa API] Filtro no mapa:', {
          recebidos: metricas.length,
          comCoordenadas: comCoordenadas.length,
          abertos: abertos.length,
          exibidosSemFiltroDeRaio: porDieta.length,
          raioIgnoradoParaQmesa: raio,
          filtroDieta: filtroDieta?.valor || null,
        });
      }

      return porDieta
        .map((item) => {
          const reservaUrlQmesa = extrairLinkReservaQmesa(item);
          if (__DEV__ && reservaUrlQmesa) {
            console.info('[Qmesa API] Link de reserva recebido no mapa:', {
              restaurante_id: item.restaurante_id,
              restaurante_nome: item.restaurante_nome,
            });
          }

          return {
            id: item.restaurante_id,
            nome: item.restaurante_nome,
            tipo: 'Restaurante parceiro Qmesa',
            latitude: item.latitude,
            longitude: item.longitude,
            foto: null,
            lotacao: calcularLotacaoPercentual(item),
            origemQmesa: true,
            movimentoAtual: item.movimento_atual || null,
            recomendacaoVisita: item.recomendacao_visita || null,
            mesasLivres: item.mesas_livres ?? null,
            capacidadeTotal: item.capacidade_total ?? null,
            reservaUrlQmesa,
          };
        });
    } catch (error) {
      console.warn('API Qmesa indisponivel, seguindo com busca padrao:', error);
      return [];
    }
  };

  const buscarLotacao = async (placeId: string): Promise<number | null> => {
    try {
      const { lotacao } = await buscarLotacaoAtual(placeId);
      return typeof lotacao === 'number' ? lotacao : null;
    } catch (error) {
      console.warn('Lotação indisponível para placeId:', placeId, error);
      return null;
    }
  };

  const atualizarLotacoes = async () => {
    if (lugares.length === 0) return;

    const lugaresAtualizados = await Promise.all(
      lugares.map(async (lugar) => ({
        ...lugar,
        lotacao: lugar.origemQmesa && lugar.lotacao !== null ? lugar.lotacao : await buscarLotacao(lugar.id),
      })),
    );

    setLugares(lugaresAtualizados);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: userLocation?.latitude || -25.42,
          longitude: userLocation?.longitude || -49.26,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapDrag}
        onPanDrag={handleMapDrag}
        customMapStyle={mapStyleLimpo}
      >
        {lugares.map((lugar) => (
          <Marker
            key={lugar.id}
            coordinate={{ latitude: lugar.latitude, longitude: lugar.longitude }}
            pinColor={getPinColor(lugar.lotacao)}
            onPress={() => setLugarSelecionado(lugar)}
          >
            {lugar.origemQmesa ? (
              <View
                style={[
                  styles.qmesaMarker,
                  {
                    backgroundColor: getPinColor(lugar.lotacao),
                    borderColor: lugar.lotacao === null ? '#FF9500' : '#FFFFFF',
                  },
                ]}
              >
                <MaterialIcons name="verified" size={18} color="#FFFFFF" />
              </View>
            ) : undefined}
          </Marker>
        ))}
      </MapView>

      {lugarSelecionado && (
        <View style={styles.balaoFixo}>
          <BalaoRestaurante
            nome={lugarSelecionado.nome}
            tipo={lugarSelecionado.tipo}
            lotacao={lugarSelecionado.lotacao}
            exibirLotacao={Boolean(authUser)}
            placeId={lugarSelecionado.id}
            foto={lugarSelecionado.foto}
            destaqueQmesa={lugarSelecionado.origemQmesa}
            movimentoAtual={lugarSelecionado.movimentoAtual}
            recomendacaoVisita={lugarSelecionado.recomendacaoVisita}
            mesasLivres={lugarSelecionado.mesasLivres}
            capacidadeTotal={lugarSelecionado.capacidadeTotal}
            reservaUrlQmesa={lugarSelecionado.reservaUrlQmesa}
            onClose={() => setLugarSelecionado(null)}
          />
        </View>
      )}

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      <View style={styles.mapHeader}>
        <TouchableOpacity style={styles.headerIconButton} onPress={abrirMenu}>
          <Feather name="menu" size={24} color="#0D47A1" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>QueueGOO</Text>
          <Text style={styles.headerSubtitle}>
            {filtroMapa ? `${obterRotuloFiltro(filtroMapa)}: ` : params.termoBusca ? `${params.termoBusca}: ` : ''}
            {lugares.length} locais, incluindo Qmesa
          </Text>
        </View>
        <TouchableOpacity style={styles.headerIconButton} onPress={irParaBuscar}>
          <Feather name="search" size={23} color="#0D47A1" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.notificationButton} onPress={irParaNotificacoes}>
          <MaterialIcons name="notifications" size={22} color="#0D47A1" />
          {notificacoesPendentes > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {notificacoesPendentes > 9 ? '9+' : notificacoesPendentes}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.legend}>
        <LegendItem color={PIN_COLORS.baixa} label="Baixa" />
        <LegendItem color={PIN_COLORS.media} label="Media" />
        <LegendItem color={PIN_COLORS.alta} label="Alta" />
        <LegendItem color={PIN_COLORS.desconhecida} label="Sem dado" />
      </View>

      <View style={styles.filterPanel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {MAP_FILTERS.map((item) => {
              const ativo = filtroMapa === item.value || (!filtroMapa && !item.value);
              return (
                <TouchableOpacity
                  key={item.value || 'todos'}
                  style={[styles.filterChip, ativo && styles.filterChipActive]}
                  onPress={() => setFiltroMapa(item.value)}
                >
                  <Text style={[styles.filterChipText, ativo && styles.filterChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {MAP_RAIOS.map((raio) => {
              const ativo = raioMapa === raio;
              return (
                <TouchableOpacity
                  key={raio}
                  style={[styles.radiusChip, ativo && styles.radiusChipActive]}
                  onPress={() => setRaioMapa(raio)}
                >
                  <Text style={[styles.radiusChipText, ativo && styles.radiusChipTextActive]}>
                    {raio / 1000} km
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.locationButton} onPress={centralizarLocal}>
        <MaterialIcons name="gps-fixed" size={24} color="#0D47A1" />
      </TouchableOpacity>

      <View style={styles.zoomContainer}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => {
            if (mapRef.current && userLocation)
              mapRef.current.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
          }}
        >
          <MaterialIcons name="add" size={22} color="#0D47A1" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => {
            if (mapRef.current && userLocation)
              mapRef.current.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              });
          }}
        >
          <MaterialIcons name="remove" size={22} color="#0D47A1" />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <TouchableWithoutFeedback onPress={fecharMenu}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View style={[styles.drawer, { left: slideAnim }]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Menu</Text>
          <TouchableOpacity onPress={fecharMenu}>
            <MaterialIcons name="close" size={28} color="#0D47A1" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.profile} onPress={irParaPerfil} activeOpacity={0.85}>
          <Image
            source={{
              uri: authUser?.photoURL || `https://i.pravatar.cc/100?u=${authUser?.uid || 'usuario'}`,
            }}
            style={styles.avatar}
          />
          <View style={styles.profileText}>
            <Text style={styles.welcome}>Olá, {nomeUsuario.split('@')[0]}</Text>
            <Text style={styles.profileHint}>Ver perfil</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.menuItems}>
          <DrawerItem label="Feed" icon="dynamic-feed" onPress={irParaFeed} />
          <DrawerItem label="Notificacoes" icon="notifications" onPress={irParaNotificacoes} />
          <DrawerItem label="Favoritos" icon="favorite" onPress={irParaFavoritos} />
          <DrawerItem label="Reservas" icon="event-seat" onPress={irParaReservas} />
          <DrawerItem label="Eventos" icon="event" onPress={irParaSocial} />
          <DrawerItem label="Role aleatorio" icon="casino" onPress={irParaRole} />
          <DrawerItem label="Fechar app" icon="exit-to-app" onPress={fecharApp} />
        </View>
      </Animated.View>
    </View>
  );
}

// Props explícitas removem `implicit any` no componente.
type DrawerItemProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
};

function DrawerItem({ label, icon, onPress }: DrawerItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIcon}>
        <MaterialIcons name={icon} size={21} color="#0D47A1" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

type LegendItemProps = {
  color: string;
  label: string;
};

function LegendItem({ color, label }: LegendItemProps) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  loading: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  legend: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
    zIndex: 10,
  },
  qmesaMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF9500',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  mapHeader: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
    zIndex: 10,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    marginLeft: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: '#1e232c',
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  headerSubtitle: {
    color: '#4B6475',
    fontSize: 12,
    marginTop: 1,
    fontFamily: 'Urbanist_600SemiBold',
  },
  balaoFixo: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    elevation: 20,
    zIndex: 1000,
  },
  filterPanel: {
    position: 'absolute',
    top: 118,
    left: 16,
    right: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingVertical: 8,
    elevation: 5,
    zIndex: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#0D47A1', borderColor: '#0D47A1' },
  filterChipText: { color: '#0D47A1', fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  filterChipTextActive: { color: '#FFFFFF' },
  radiusChip: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  radiusChipText: { color: '#0D47A1', fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  radiusChipTextActive: { color: '#FFFFFF' },
  locationButton: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  zoomContainer: {
    position: 'absolute',
    right: 20,
    bottom: 150,
    justifyContent: 'space-between',
    height: 100,
    zIndex: 10,
  },
  zoomButton: {
    backgroundColor: 'white',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    elevation: 5,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: menuWidth,
    backgroundColor: '#E3F2FD',
    paddingTop: 50,
    paddingHorizontal: 18,
    elevation: 8,
    zIndex: 20,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,71,161,0.16)',
    zIndex: 15,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingRight: 8,
  },
  drawerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: '#1e232c',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  profileText: { marginLeft: 12, flex: 1 },
  welcome: { fontSize: 16, fontWeight: '700', color: '#111827' },
  profileHint: { color: '#0D47A1', fontSize: 12, fontFamily: 'Urbanist_700Bold', marginTop: 2 },
  menuItems: { gap: 10 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
  },
  menuLabel: { fontSize: 15, color: '#111827', fontFamily: 'Urbanist_700Bold' },
});


