import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

import { auth, db } from '@/firebaseconfig';
import {
  consultarCardapioQmesa,
  extrairLinkReservaQmesa,
  listarLotacoesQmesa,
  QmesaCardapioItem,
} from '@/src/services/qmesaPublicApi';
import {
  buscarRestaurantesPorTexto,
  buscarRestaurantesProximos,
  RestauranteResumo,
} from '@/src/services/restauranteServices';
import { criarNotificacaoUsuario } from '@/src/services/pushNotificationService';
import { isValidEmail, normalizeEmail } from '@/src/utils/validation';

type GrupoRole = {
  id: string;
  nome: string;
  descricao: string;
  participantes: string[];
  criadoPor: string;
  criadoPorNome: string;
  restauranteSorteado?: RestauranteSorteado | null;
};

type MensagemRole = {
  id: string;
  uid: string;
  nome: string;
  texto: string;
};

type UsuarioConvite = {
  uid: string;
  nome: string;
  email: string;
  fotoUrl?: string | null;
};

type RestauranteSorteado = {
  id: string;
  nome: string;
  endereco?: string;
  origem: 'QueueGOO' | 'Qmesa';
  fotoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanciaMetros?: number | null;
  possuiCardapio?: boolean;
  cardapioPreview?: string[];
  reservaUrlQmesa?: string | null;
};

const COLLECTION = 'role_grupos';
const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';
const CURITIBA = { latitude: -25.4284, longitude: -49.2733 };
const RAIOS_SORTEIO = [1500, 3000, 7000, 12000, 20000, 50000];

function avatarFallback(uid?: string) {
  return `https://i.pravatar.cc/120?u=${uid || 'role'}`;
}

function nomeUsuario(user: User | null) {
  return user?.displayName || user?.email?.split('@')[0] || 'Usuario';
}

function sortear<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function calcularDistanciaMetros(
  origem: { latitude: number; longitude: number },
  destino: { latitude: number; longitude: number },
) {
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

function formatarDistancia(distancia?: number | null) {
  if (typeof distancia !== 'number') return null;
  if (distancia < 1000) return `${Math.round(distancia)} m`;
  return `${(distancia / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatarRaio(raio: number) {
  if (raio < 1000) return `${raio} m`;
  return `${raio / 1000} km`;
}

function resumirCardapio(cardapio: QmesaCardapioItem[]) {
  return cardapio
    .filter((item) => item.nome)
    .slice(0, 3)
    .map((item) => item.nome);
}

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function primeiraImagemCardapio(cardapio: QmesaCardapioItem[]) {
  return cardapio.find((item) => item.imagem_url)?.imagem_url || null;
}

export default function RoleScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [grupos, setGrupos] = useState<GrupoRole[]>([]);
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState('');
  const [mensagens, setMensagens] = useState<MensagemRole[]>([]);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [descricaoGrupo, setDescricaoGrupo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [termoSorteio, setTermoSorteio] = useState('');
  const [buscaConvite, setBuscaConvite] = useState('');
  const [raioSorteio, setRaioSorteio] = useState(12000);
  const [loading, setLoading] = useState(true);
  const [sorteando, setSorteando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const grupoCriadoPendente = useRef<string | null>(null);

  const grupoSelecionado = useMemo(
    () => grupos.find((grupo) => grupo.id === grupoSelecionadoId) || null,
    [grupoSelecionadoId, grupos],
  );

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) {
      setGrupos([]);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTION),
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => {
          const dados = documento.data();
          return {
            id: documento.id,
            nome: String(dados.nome || 'Role sem nome'),
            descricao: String(dados.descricao || ''),
            participantes: Array.isArray(dados.participantes) ? dados.participantes : [],
            criadoPor: String(dados.criadoPor || ''),
            criadoPorNome: String(dados.criadoPorNome || 'Usuario'),
            restauranteSorteado:
              dados.restauranteSorteado && typeof dados.restauranteSorteado === 'object'
                ? (dados.restauranteSorteado as RestauranteSorteado)
                : null,
          };
        });

        const meusGrupos = lista
          .filter((grupo) => grupo.participantes.includes(user.uid) || grupo.criadoPor === user.uid)
          .sort((a, b) => a.nome.localeCompare(b.nome));

        setGrupos(meusGrupos);
        setGrupoSelecionadoId((atual) => {
          const pendente = grupoCriadoPendente.current;
          if (pendente && meusGrupos.some((grupo) => grupo.id === pendente)) {
            grupoCriadoPendente.current = null;
            return pendente;
          }

          if (atual && meusGrupos.some((grupo) => grupo.id === atual)) {
            return atual;
          }

          return meusGrupos[0]?.id || '';
        });
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar grupos de role:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!grupoSelecionadoId) {
      setMensagens([]);
      return undefined;
    }

    const mensagensRef = collection(db, COLLECTION, grupoSelecionadoId, 'mensagens');
    const unsubscribe = onSnapshot(
      query(mensagensRef, orderBy('criadoEm', 'asc')),
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
      },
      (error) => {
        console.error('Erro ao carregar chat do role:', error);
        setMensagens([]);
      },
    );

    return () => unsubscribe();
  }, [grupoSelecionadoId]);

  const criarGrupo = async () => {
    if (!user) {
      Alert.alert('Login necessario', 'Entre para criar um grupo de role.');
      return;
    }
    if (!nomeGrupo.trim()) {
      Alert.alert('Nome do role', 'De um nome para o grupo.');
      return;
    }

    const novoGrupo = await addDoc(collection(db, COLLECTION), {
      nome: nomeGrupo.trim(),
      descricao: descricaoGrupo.trim(),
      participantes: [user.uid],
      criadoPor: user.uid,
      criadoPorNome: nomeUsuario(user),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      restauranteSorteado: null,
    });

    grupoCriadoPendente.current = novoGrupo.id;
    const grupoLocal: GrupoRole = {
      id: novoGrupo.id,
      nome: nomeGrupo.trim(),
      descricao: descricaoGrupo.trim(),
      participantes: [user.uid],
      criadoPor: user.uid,
      criadoPorNome: nomeUsuario(user),
      restauranteSorteado: null,
    };

    setGrupos((atuais) => {
      const semDuplicar = atuais.filter((grupo) => grupo.id !== novoGrupo.id);
      return [grupoLocal, ...semDuplicar];
    });
    setNomeGrupo('');
    setDescricaoGrupo('');
    setGrupoSelecionadoId(novoGrupo.id);
  };

  const enviarMensagem = async () => {
    if (!user || !grupoSelecionadoId || !mensagem.trim()) return;

    await addDoc(collection(db, COLLECTION, grupoSelecionadoId, 'mensagens'), {
      uid: user.uid,
      nome: nomeUsuario(user),
      texto: mensagem.trim(),
      criadoEm: serverTimestamp(),
    });
    setMensagem('');
  };

  const buscarUsuarioParaConvite = async (termo: string): Promise<UsuarioConvite | null> => {
    const termoLimpo = termo.trim();
    if (!termoLimpo) return null;

    if (isValidEmail(normalizeEmail(termoLimpo))) {
      const email = normalizeEmail(termoLimpo);
      const porEmailLower = await getDocs(
        query(collection(db, 'usuarios'), where('emailLower', '==', email), limit(1)),
      );
      const snapshot = porEmailLower.empty
        ? await getDocs(query(collection(db, 'usuarios'), where('email', '==', email), limit(1)))
        : porEmailLower;
      const documento = snapshot.docs[0];
      if (documento) {
        const dados = documento.data();
        return {
          uid: documento.id,
          nome: String(dados.nome || dados.displayName || dados.email || 'Usuario'),
          email: String(dados.email || ''),
          fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
        };
      }
    }

    const termoNormalizado = normalizarTexto(termoLimpo);
    const usuariosSnapshot = await getDocs(query(collection(db, 'usuarios'), limit(100)));
    const documento = usuariosSnapshot.docs.find((docUsuario) => {
      const dados = docUsuario.data();
      const nome = normalizarTexto(String(dados.nome || dados.displayName || ''));
      const email = normalizarTexto(String(dados.email || ''));
      return nome.includes(termoNormalizado) || email.includes(termoNormalizado);
    });

    if (!documento) return null;

    const dados = documento.data();
    return {
      uid: documento.id,
      nome: String(dados.nome || dados.displayName || dados.email || 'Usuario'),
      email: String(dados.email || ''),
      fotoUrl: typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null,
    };
  };

  const convidarParaRole = async () => {
    if (!user || !grupoSelecionado) return;

    const termo = buscaConvite.trim();
    if (!termo) {
      Alert.alert('Convite', 'Digite o nome ou email de uma pessoa cadastrada no app.');
      return;
    }

    setConvidando(true);
    try {
      const convidado = await buscarUsuarioParaConvite(termo);
      if (!convidado) {
        Alert.alert(
          'Usuario nao encontrado',
          'Para o role aleatorio, por enquanto o convite entra para pessoas que ja tem perfil no app. Tente buscar pelo nome ou email cadastrado.',
        );
        return;
      }

      if (convidado.uid === user.uid) {
        Alert.alert('Voce ja esta no role', 'Esse grupo ja esta na sua lista.');
        return;
      }

      if (grupoSelecionado.participantes.includes(convidado.uid)) {
        Alert.alert('Ja esta no role', `${convidado.nome} ja participa deste grupo.`);
        setBuscaConvite('');
        return;
      }

      await updateDoc(doc(db, COLLECTION, grupoSelecionado.id), {
        participantes: arrayUnion(convidado.uid),
        atualizadoEm: serverTimestamp(),
      });

      setGrupos((atuais) =>
        atuais.map((grupo) =>
          grupo.id === grupoSelecionado.id
            ? { ...grupo, participantes: [...grupo.participantes, convidado.uid] }
            : grupo,
        ),
      );

      await addDoc(collection(db, COLLECTION, grupoSelecionado.id, 'mensagens'), {
        uid: user.uid,
        nome: nomeUsuario(user),
        texto: `${convidado.nome} entrou no role.`,
        criadoEm: serverTimestamp(),
      });

      await criarNotificacaoUsuario(convidado.uid, {
        tipo: 'chat',
        titulo: 'Convite para role',
        mensagem: `${nomeUsuario(user)} te adicionou ao role "${grupoSelecionado.nome}".`,
        chatId: grupoSelecionado.id,
        link: `/screens/role`,
      });

      setBuscaConvite('');
      Alert.alert('Convite enviado', `${convidado.nome} foi adicionado ao role.`);
    } catch (error) {
      console.error('Erro ao convidar para role:', error);
      Alert.alert('Erro', 'Nao foi possivel convidar essa pessoa agora.');
    } finally {
      setConvidando(false);
    }
  };

  const obterCoordenadas = async () => {
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (permissao.status !== 'granted') return CURITIBA;

    const local = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: local.coords.latitude,
      longitude: local.coords.longitude,
    };
  };

  const buscarOpcoesSorteio = useCallback(async () => {
    const coords = await obterCoordenadas();
    const termo = termoSorteio.trim();
    const [externos, qmesa] = await Promise.all([
      termo
        ? buscarRestaurantesPorTexto(termo, coords.latitude, coords.longitude, raioSorteio)
        : buscarRestaurantesProximos(coords.latitude, coords.longitude, raioSorteio),
      listarLotacoesQmesa().catch(() => []),
    ]);

    const opcoesExternas: RestauranteSorteado[] = externos
      .filter((item: RestauranteResumo) => item.google_place_id && item.nome)
      .sort((a, b) => (a.distancia_metros ?? Number.MAX_SAFE_INTEGER) - (b.distancia_metros ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 25)
      .map((item) => ({
        id: item.google_place_id,
        nome: item.nome,
        endereco: item.endereco,
        origem: 'QueueGOO',
        fotoUrl: item.foto_url || null,
        latitude: item.latitude,
        longitude: item.longitude,
        distanciaMetros: item.distancia_metros ?? null,
        possuiCardapio: false,
      }));

    const termoNormalizado = termo.toLowerCase();
    const qmesaProximos = qmesa
      .filter((item) => {
        if (termoNormalizado && !item.restaurante_nome.toLowerCase().includes(termoNormalizado)) {
          return false;
        }

        return typeof item.latitude === 'number' && typeof item.longitude === 'number';
      })
      .map((item) => ({
        item,
        distancia: calcularDistanciaMetros(coords, {
          latitude: item.latitude as number,
          longitude: item.longitude as number,
        }),
      }))
      .filter(({ distancia }) => distancia <= raioSorteio)
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 12);

    const opcoesQmesa = await Promise.all(
      qmesaProximos.map(async ({ item, distancia }) => {
        const cardapio = await consultarCardapioQmesa(item.restaurante_id).catch(() => []);
        const preview = resumirCardapio(cardapio);
        const fotoUrl = primeiraImagemCardapio(cardapio);

        return {
          id: item.restaurante_id,
          nome: item.restaurante_nome,
          endereco: 'Parceiro Qmesa com dados ao vivo',
          origem: 'Qmesa' as const,
          fotoUrl,
          latitude: item.latitude,
          longitude: item.longitude,
          distanciaMetros: distancia,
          possuiCardapio: preview.length > 0,
          cardapioPreview: preview,
          reservaUrlQmesa: extrairLinkReservaQmesa(item),
        };
      }),
    );

    const opcoes = [...opcoesQmesa, ...opcoesExternas];

    return opcoes.sort((a, b) => {
      const cardapioScore = Number(Boolean(b.possuiCardapio)) - Number(Boolean(a.possuiCardapio));
      if (cardapioScore !== 0) return cardapioScore;

      return (a.distanciaMetros ?? Number.MAX_SAFE_INTEGER) - (b.distanciaMetros ?? Number.MAX_SAFE_INTEGER);
    });
  }, [raioSorteio, termoSorteio]);

  const sortearRestaurante = async () => {
    if (!user || !grupoSelecionadoId) return;

    setSorteando(true);
    try {
      const opcoes = await buscarOpcoesSorteio();
      if (opcoes.length === 0) {
        Alert.alert('Sem opcoes', 'Nao encontrei restaurantes para sortear.');
        return;
      }

      const restaurante = sortear(opcoes);
      setGrupos((atuais) =>
        atuais.map((grupo) =>
          grupo.id === grupoSelecionadoId
            ? { ...grupo, restauranteSorteado: restaurante }
            : grupo,
        ),
      );
      await updateDoc(doc(db, COLLECTION, grupoSelecionadoId), {
        restauranteSorteado: restaurante,
        atualizadoEm: serverTimestamp(),
      });
      await addDoc(collection(db, COLLECTION, grupoSelecionadoId, 'mensagens'), {
        uid: user.uid,
        nome: 'Sorteio',
        texto: `O role caiu em: ${restaurante.nome} (${restaurante.origem})${
          restaurante.cardapioPreview?.length
            ? ` | Cardapio: ${restaurante.cardapioPreview.join(', ')}`
            : ''
        }`,
        criadoEm: serverTimestamp(),
      });
    } catch (error) {
      console.error('Erro ao sortear restaurante:', error);
      Alert.alert('Erro', 'Nao foi possivel sortear agora.');
    } finally {
      setSorteando(false);
    }
  };

  const entrarNoGrupoAtual = async () => {
    if (!user || !grupoSelecionadoId) return;
    await updateDoc(doc(db, COLLECTION, grupoSelecionadoId), {
      participantes: arrayUnion(user.uid),
      atualizadoEm: serverTimestamp(),
    });
  };

  const apagarGrupoAtual = () => {
    if (!user || !grupoSelecionado) return;

    if (grupoSelecionado.criadoPor !== user.uid) {
      Alert.alert('Apenas o criador', 'Somente quem criou o role pode apagar o grupo.');
      return;
    }

    Alert.alert(
      'Apagar role',
      `Tem certeza que deseja apagar "${grupoSelecionado.nome}"? O grupo sai da sua lista e o chat deixa de ficar acessivel.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, COLLECTION, grupoSelecionado.id));
              setGrupoSelecionadoId('');
              setMensagens([]);
            } catch (error) {
              console.error('Erro ao apagar grupo de role:', error);
              Alert.alert('Erro', 'Nao foi possivel apagar este role agora.');
            }
          },
        },
      ],
    );
  };

  const abrirRestauranteNoMapa = () => {
    const restaurante = grupoSelecionado?.restauranteSorteado;
    if (typeof restaurante?.latitude !== 'number' || typeof restaurante.longitude !== 'number') {
      Alert.alert('Mapa indisponivel', 'Esse restaurante ainda nao tem coordenadas para abrir no mapa.');
      return;
    }

    router.push({
      pathname: '/screens/mapa',
      params: {
        rolePlaceId: restaurante.id,
        roleNome: restaurante.nome,
        roleOrigemQmesa: restaurante.origem === 'Qmesa' ? '1' : '0',
        roleLatitude: String(restaurante.latitude),
        roleLongitude: String(restaurante.longitude),
        roleFotoUrl: restaurante.fotoUrl || '',
        roleReservaUrlQmesa: restaurante.reservaUrlQmesa || '',
      },
    } as never);
  };

  const abrirRestauranteDetalhes = () => {
    const restaurante = grupoSelecionado?.restauranteSorteado;
    if (!restaurante) return;

    router.push({
      pathname: '/screens/restaurante',
      params: {
        placeId: restaurante.id,
        nome: restaurante.nome,
        tipo: restaurante.origem === 'Qmesa' ? 'Restaurante parceiro Qmesa' : 'Restaurante',
        origemQmesa: restaurante.origem === 'Qmesa' ? '1' : '0',
        fotoUrl: restaurante.fotoUrl || undefined,
        reservaUrlQmesa: restaurante.reservaUrlQmesa || undefined,
      },
    } as never);
  };

  const reservarRestauranteSorteado = async () => {
    const restaurante = grupoSelecionado?.restauranteSorteado;
    if (!restaurante) return;

    if (restaurante.origem === 'Qmesa') {
      if (!restaurante.reservaUrlQmesa) {
        Alert.alert('Reserva indisponivel', 'Este parceiro Qmesa ainda nao enviou link de reserva.');
        return;
      }

      const podeAbrir = await Linking.canOpenURL(restaurante.reservaUrlQmesa);
      if (!podeAbrir) {
        Alert.alert('Erro', 'Nao foi possivel abrir o link de reserva Qmesa.');
        return;
      }

      await Linking.openURL(restaurante.reservaUrlQmesa);
      return;
    }

    abrirRestauranteDetalhes();
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialIcons name="groups" size={36} color={BLUE_DARK} />
          <Text style={styles.emptyTitle}>Entre para montar um role</Text>
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Role aleatorio</Text>
            <Text style={styles.headerSubtitle}>Grupo, chat e sorteio de restaurante</Text>
          </View>
          <View style={styles.iconGhost} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Criar grupo</Text>
            <TextInput
              style={styles.input}
              value={nomeGrupo}
              onChangeText={setNomeGrupo}
              placeholder="Ex: Role de sexta"
              placeholderTextColor="#667085"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={descricaoGrupo}
              onChangeText={setDescricaoGrupo}
              placeholder="Combinado, clima do role, restricoes..."
              placeholderTextColor="#667085"
              multiline
            />
            <TouchableOpacity style={styles.primaryButton} onPress={criarGrupo}>
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Criar grupo de role</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Meus grupos</Text>
          {loading ? <ActivityIndicator color={BLUE_DARK} style={styles.loader} /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.groupRow}>
              {grupos.map((grupo) => {
                const ativo = grupo.id === grupoSelecionadoId;
                return (
                  <TouchableOpacity
                    key={grupo.id}
                    style={[styles.groupChip, ativo && styles.groupChipActive]}
                    onPress={() => setGrupoSelecionadoId(grupo.id)}
                  >
                    <Text style={[styles.groupChipText, ativo && styles.groupChipTextActive]}>
                      {grupo.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {grupoSelecionado ? (
            <>
              <View style={styles.panel}>
                <View style={styles.groupHeader}>
                  <View>
                    <Text style={styles.roleTitle}>{grupoSelecionado.nome}</Text>
                    <Text style={styles.roleSubtitle}>
                      {grupoSelecionado.participantes.length} participante(s)
                    </Text>
                  </View>
                  <View style={styles.groupActions}>
                    <TouchableOpacity style={styles.smallButton} onPress={entrarNoGrupoAtual}>
                      <MaterialIcons name="person-add-alt" size={18} color={BLUE_DARK} />
                    </TouchableOpacity>
                    {grupoSelecionado.criadoPor === user.uid ? (
                      <TouchableOpacity style={styles.deleteButton} onPress={apagarGrupoAtual}>
                        <MaterialIcons name="delete-outline" size={18} color="#B42318" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                {grupoSelecionado.descricao ? (
                  <Text style={styles.description}>{grupoSelecionado.descricao}</Text>
                ) : null}

                <View style={styles.inviteBox}>
                  <Text style={styles.inviteTitle}>Convidar para o role</Text>
                  <View style={styles.inviteRow}>
                    <TextInput
                      style={styles.inviteInput}
                      value={buscaConvite}
                      onChangeText={setBuscaConvite}
                      placeholder="Nome ou email do app"
                      placeholderTextColor="#667085"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.inviteButton, convidando && styles.disabledButton]}
                      onPress={convidarParaRole}
                      disabled={convidando}
                    >
                      {convidando ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <MaterialIcons name="person-add-alt" size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inviteHint}>
                    Busque por nome ou email cadastrado. A pessoa entra no grupo e recebe notificacao.
                  </Text>
                </View>

                {grupoSelecionado.restauranteSorteado ? (
                  <View style={styles.winnerBox}>
                    {grupoSelecionado.restauranteSorteado.fotoUrl ? (
                      <Image
                        source={{ uri: grupoSelecionado.restauranteSorteado.fotoUrl }}
                        style={styles.winnerImage}
                      />
                    ) : (
                      <View style={styles.winnerImageFallback}>
                        <MaterialIcons name="casino" size={24} color="#B7791F" />
                      </View>
                    )}
                    <View style={styles.winnerTextArea}>
                      <Text style={styles.winnerLabel}>Restaurante sorteado</Text>
                      <Text style={styles.winnerName}>{grupoSelecionado.restauranteSorteado.nome}</Text>
                      <Text style={styles.winnerMeta}>
                        {grupoSelecionado.restauranteSorteado.origem}
                        {formatarDistancia(grupoSelecionado.restauranteSorteado.distanciaMetros)
                          ? ` - ${formatarDistancia(grupoSelecionado.restauranteSorteado.distanciaMetros)}`
                          : ''}
                        {grupoSelecionado.restauranteSorteado.endereco
                          ? ` - ${grupoSelecionado.restauranteSorteado.endereco}`
                          : ''}
                      </Text>
                      {grupoSelecionado.restauranteSorteado.cardapioPreview?.length ? (
                        <View style={styles.menuPreview}>
                          <MaterialIcons name="restaurant-menu" size={15} color="#7A3E00" />
                          <Text style={styles.menuPreviewText}>
                            {grupoSelecionado.restauranteSorteado.cardapioPreview.join(' • ')}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.winnerActions}>
                        <TouchableOpacity style={styles.winnerActionButton} onPress={abrirRestauranteNoMapa}>
                          <MaterialIcons name="map" size={17} color={BLUE_DARK} />
                          <Text style={styles.winnerActionText}>Ver no mapa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.winnerActionButton} onPress={abrirRestauranteDetalhes}>
                          <MaterialIcons name="restaurant-menu" size={17} color={BLUE_DARK} />
                          <Text style={styles.winnerActionText}>
                            {grupoSelecionado.restauranteSorteado.origem === 'Qmesa'
                              ? 'Ver cardapio'
                              : 'Ver detalhes'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.winnerActionButton} onPress={reservarRestauranteSorteado}>
                          <MaterialIcons name="event-available" size={17} color={BLUE_DARK} />
                          <Text style={styles.winnerActionText}>Reservar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ) : null}

                <TextInput
                  style={styles.input}
                  value={termoSorteio}
                  onChangeText={setTermoSorteio}
                  placeholder="Filtro do sorteio: pizza, sushi, burger..."
                  placeholderTextColor="#667085"
                />
                <Text style={styles.filterLabel}>Raio do sorteio</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.radiusRow}
                >
                  {RAIOS_SORTEIO.map((raio) => {
                    const ativo = raioSorteio === raio;
                    return (
                      <TouchableOpacity
                        key={raio}
                        style={[styles.radiusChip, ativo && styles.radiusChipActive]}
                        onPress={() => setRaioSorteio(raio)}
                      >
                        <Text style={[styles.radiusChipText, ativo && styles.radiusChipTextActive]}>
                          {formatarRaio(raio)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.drawButton, sorteando && styles.disabledButton]}
                  onPress={sortearRestaurante}
                  disabled={sorteando}
                >
                  {sorteando ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="casino" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>
                        {grupoSelecionado.restauranteSorteado ? 'Sortear de novo' : 'Sortear restaurante'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Chat do role</Text>
                <View style={styles.messages}>
                  {mensagens.length ? (
                    mensagens.map((item) => {
                      const minha = item.uid === user.uid;
                      return (
                        <View key={item.id} style={[styles.messageRow, minha && styles.messageRowMine]}>
                          {!minha && (
                            <Image source={{ uri: avatarFallback(item.uid) }} style={styles.avatar} />
                          )}
                          <View style={[styles.messageBubble, minha && styles.messageBubbleMine]}>
                            <Text style={[styles.messageName, minha && styles.messageNameMine]}>
                              {item.nome}
                            </Text>
                            <Text style={[styles.messageText, minha && styles.messageTextMine]}>
                              {item.texto}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyChat}>Sem mensagens ainda. Puxa o primeiro assunto.</Text>
                  )}
                </View>
                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    value={mensagem}
                    onChangeText={setMensagem}
                    placeholder="Mensagem"
                    placeholderTextColor="#667085"
                  />
                  <TouchableOpacity style={styles.sendButton} onPress={enviarMensagem}>
                    <MaterialIcons name="send" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyPanel}>
              <MaterialIcons name="celebration" size={34} color={BLUE_DARK} />
              <Text style={styles.emptyTitle}>Crie um grupo para comecar</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { color: INK, fontSize: 22, fontFamily: 'Poppins_700Bold' },
  headerSubtitle: { color: '#4B6475', fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 14,
  },
  panelTitle: { color: INK, fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 10 },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    color: INK,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  textArea: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold', fontSize: 15 },
  sectionLabel: { color: INK, fontFamily: 'Urbanist_700Bold', marginBottom: 8 },
  groupRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  groupChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupChipActive: { backgroundColor: BLUE_DARK, borderColor: BLUE_DARK },
  groupChipText: { color: BLUE_DARK, fontFamily: 'Urbanist_700Bold' },
  groupChipTextActive: { color: '#FFFFFF' },
  loader: { marginVertical: 12 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleTitle: { color: INK, fontSize: 20, fontFamily: 'Poppins_700Bold' },
  roleSubtitle: { color: '#4B6475', fontSize: 13, marginTop: 2 },
  smallButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { color: '#344054', lineHeight: 20, marginTop: 10, marginBottom: 12 },
  inviteBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    padding: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  inviteTitle: {
    color: INK,
    fontSize: 13,
    fontFamily: 'Urbanist_700Bold',
    marginBottom: 8,
  },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    color: INK,
    paddingHorizontal: 12,
  },
  inviteButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteHint: { color: '#667085', fontSize: 12, lineHeight: 17, marginTop: 8 },
  winnerBox: {
    borderRadius: 8,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: '#FFD18A',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  winnerTextArea: { flex: 1 },
  winnerImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#FFE7BA',
  },
  winnerImageFallback: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#FFE7BA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerLabel: { color: '#7A3E00', fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  winnerName: { color: INK, fontSize: 17, fontFamily: 'Poppins_700Bold', marginTop: 2 },
  winnerMeta: { color: '#7A3E00', fontSize: 12, lineHeight: 17, marginTop: 2 },
  menuPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  menuPreviewText: { flex: 1, color: '#7A3E00', fontSize: 12, lineHeight: 17 },
  winnerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  winnerActionButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFD18A',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  winnerActionText: { color: BLUE_DARK, fontSize: 13, fontFamily: 'Urbanist_700Bold' },
  filterLabel: {
    color: INK,
    fontSize: 13,
    fontFamily: 'Urbanist_700Bold',
    marginBottom: 8,
  },
  radiusRow: { gap: 8, paddingBottom: 10 },
  radiusChip: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusChipActive: { backgroundColor: BLUE_DARK, borderColor: BLUE_DARK },
  radiusChipText: { color: BLUE_DARK, fontSize: 13, fontFamily: 'Urbanist_700Bold' },
  radiusChipTextActive: { color: '#FFFFFF' },
  drawButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#B7791F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: { opacity: 0.7 },
  messages: { gap: 10, marginBottom: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowMine: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  messageBubbleMine: { backgroundColor: BLUE_DARK },
  messageName: { color: BLUE_DARK, fontSize: 12, fontFamily: 'Urbanist_700Bold' },
  messageNameMine: { color: '#B3E5FC' },
  messageText: { color: INK, fontSize: 14, lineHeight: 19, marginTop: 2 },
  messageTextMine: { color: '#FFFFFF' },
  emptyChat: { color: '#667085', textAlign: 'center', paddingVertical: 20 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    paddingHorizontal: 12,
    color: INK,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyTitle: { color: INK, fontSize: 17, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
});
