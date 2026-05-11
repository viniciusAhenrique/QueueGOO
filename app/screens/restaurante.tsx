import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ModalReserva from '../components/reserva_usuario';
import { auth } from '@/firebaseconfig';
import {
  adicionarFavorito,
  removerFavorito,
  verificarFavorito,
} from '@/src/services/favoritosService';
import { buscarDetalhesRestaurante } from '@/src/services/restauranteServices';

interface RestauranteDetalhes {
  nome: string;
  nota_google?: number;
  tipos?: string[];
  foto_url?: string | null;
  endereco?: string;
  telefone?: string;
  site_url?: string;
  google_maps_url?: string;
  reservavel_google?: boolean;
  horarios?: string[];
  avaliacao_externa?: {
    fonte: string;
    nota?: number | null;
    total?: number | null;
    ranking?: string | null;
    url?: string | null;
    rating_image_url?: string | null;
  };
  fotos_externas?: Array<{
    url: string;
    legenda?: string | null;
    atribuicao?: string | null;
  }>;
  geoapify_extras?: {
    descricao?: string;
    cozinha?: string | string[];
    reserva?: string | boolean;
    capacidade?: string | number;
    delivery?: string | boolean;
    takeaway?: string | boolean;
    outdoor_seating?: string | boolean;
    wheelchair?: string | boolean;
    estacionamento?: string | boolean;
    playground?: string | boolean;
    aceita_cartao?: string | boolean;
  };
}

interface RestauranteFavorito {
  id: string;
  placeId: string;
  nome: string;
  tipo: string;
  lotacao: number;
  foto: string | null;
}

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function Restaurante() {
  const { placeId, lotacao } = useLocalSearchParams<{ placeId: string; lotacao?: string }>();
  const router = useRouter();
  const lotacaoRecebida = lotacao !== undefined ? Number(lotacao) : null;
  const temLotacao = typeof lotacaoRecebida === 'number' && Number.isFinite(lotacaoRecebida);
  const lotacaoPercentual = temLotacao ? lotacaoRecebida : null;

  const [detalhes, setDetalhes] = useState<RestauranteDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [favoritado, setFavoritado] = useState(false);

  const user = auth.currentUser;

  const buscarDetalhesDoLugar = useCallback(async () => {
    if (!placeId) {
      setLoading(false);
      return;
    }

    try {
      const data = await buscarDetalhesRestaurante(placeId);
      if (data) {
        setDetalhes(data);
      } else {
        Alert.alert('Erro', 'Informacoes do restaurante nao encontradas.');
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do restaurante:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar as informacoes do restaurante.');
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    buscarDetalhesDoLugar();
  }, [buscarDetalhesDoLugar]);

  useEffect(() => {
    const checarFavorito = async () => {
      if (user && placeId) {
        const fav = await verificarFavorito(user.uid, placeId);
        setFavoritado(fav);
      }
    };

    checarFavorito();
  }, [placeId, user]);

  const toggleFavorito = async () => {
    if (!user) {
      Alert.alert('Acesso negado', 'Voce precisa estar logado para adicionar favoritos.');
      return;
    }

    if (!detalhes || !placeId) {
      Alert.alert('Erro', 'Informacoes do restaurante nao carregadas.');
      return;
    }

    try {
      const restaurante: RestauranteFavorito = {
        id: placeId,
        placeId,
        nome: detalhes.nome,
        tipo: detalhes.tipos?.[0]?.replace('_', ' ') || 'Restaurante',
        lotacao: lotacaoPercentual ?? 0,
        foto: detalhes.foto_url || null,
      };

      if (favoritado) {
        await removerFavorito(user.uid, placeId);
        setFavoritado(false);
        Alert.alert('Sucesso', 'Removido dos favoritos.');
      } else {
        await adicionarFavorito(user.uid, restaurante);
        setFavoritado(true);
        Alert.alert('Sucesso', 'Adicionado aos favoritos.');
      }
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
      Alert.alert('Erro', 'Nao foi possivel atualizar os favoritos.');
    }
  };

  const abrirCardapioOuSite = async () => {
    const destino = detalhes?.site_url || detalhes?.avaliacao_externa?.url || detalhes?.google_maps_url;

    if (!destino) {
      Alert.alert('Indisponivel', 'Este restaurante nao informou site ou pagina externa.');
      return;
    }

    const podeAbrir = await Linking.canOpenURL(destino);
    if (!podeAbrir) {
      Alert.alert('Erro', 'Nao foi possivel abrir o link do restaurante.');
      return;
    }

    await Linking.openURL(destino);
  };

  const irParaEvento = (pessoas?: string, data?: Date) => {
    if (!detalhes || !placeId) return;

    const dataEvento = data ? data.toISOString().slice(0, 10) : '';
    const horaEvento = data
      ? data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    setModalVisible(false);
    router.push({
      pathname: '/screens/social',
      params: {
        novoEvento: '1',
        placeId,
        local: detalhes.nome,
        data: dataEvento,
        hora: horaEvento,
        pessoas: pessoas || '',
      },
    });
  };

  const calcularTempoEspera = (lot: number): string => {
    if (lot > 80) return '30-50 min';
    if (lot >= 40) return '15-30 min';
    return '5-15 min';
  };

  const calcularPessoasNaFila = (lot: number): string => {
    if (lot > 80) return '+30 pessoas';
    if (lot >= 40) return '10-30 pessoas';
    return 'menos de 10';
  };

  const calcularStatusLotacao = (lot: number): 'baixa' | 'media' | 'alta' => {
    if (lot > 80) return 'alta';
    if (lot >= 40) return 'media';
    return 'baixa';
  };

  const traduzirDiasEHorarios = (horariosTexto: string[] | undefined): string[] => {
    if (!horariosTexto) return [];

    const traducaoDias: Record<string, string> = {
      Monday: 'Segunda-feira',
      Tuesday: 'Terca-feira',
      Wednesday: 'Quarta-feira',
      Thursday: 'Quinta-feira',
      Friday: 'Sexta-feira',
      Saturday: 'Sabado',
      Sunday: 'Domingo',
    };

    const converterPara24h = (hora: string): string => {
      const regex = /(\d{1,2}):(\d{2})\s(AM|PM)/gi;
      return hora.replace(regex, (_match, horas, minutos, periodo) => {
        let h = parseInt(horas, 10);

        if (periodo.toUpperCase() === 'PM' && h !== 12) {
          h += 12;
        } else if (periodo.toUpperCase() === 'AM' && h === 12) {
          h = 0;
        }

        return `${String(h).padStart(2, '0')}:${minutos}`;
      });
    };

    return horariosTexto.map((horario) => {
      let texto = horario;
      for (const [ingles, portugues] of Object.entries(traducaoDias)) {
        texto = texto.replace(new RegExp(`^${ingles}`, 'i'), portugues);
      }
      return converterPara24h(texto);
    });
  };

  const valorDisponibilidade = (valor: unknown) => {
    if (valor === true || valor === 'yes' || valor === 'true' || valor === '1') return 'Sim';
    if (valor === false || valor === 'no' || valor === 'false' || valor === '0') return 'Nao';
    if (Array.isArray(valor)) return valor.join(', ');
    if (valor === undefined || valor === null || valor === '') return '';
    return String(valor).replace(/_/g, ' ');
  };

  const renderLotacao = (nivel: 'baixa' | 'media' | 'alta') => {
    const cores = { baixa: '#2E7D32', media: '#B7791F', alta: '#C62828' } as const;
    const icones = { baixa: 'check-circle', media: 'error', alta: 'warning' } as const;
    const textos = { baixa: 'Baixa', media: 'Media', alta: 'Alta' } as const;

    return (
      <View style={[styles.lotacaoBox, { backgroundColor: `${cores[nivel]}18` }]}>
        <MaterialIcons name={icones[nivel]} size={17} color={cores[nivel]} />
        <Text style={[styles.lotacaoTexto, { color: cores[nivel] }]}>
          Lotacao {textos[nivel]}
        </Text>
      </View>
    );
  };

  if (!placeId) return <Text style={{ padding: 20 }}>Restaurante nao encontrado.</Text>;
  if (loading) return <ActivityIndicator size="large" color="#4FC3F7" style={{ marginTop: 50 }} />;
  if (!detalhes) return <Text style={{ padding: 20 }}>Erro ao carregar dados.</Text>;

  const imagem =
    detalhes.foto_url ||
    detalhes.fotos_externas?.[0]?.url ||
    'https://via.placeholder.com/800x400.png?text=Restaurante';
  const avaliacaoPrincipal = detalhes.avaliacao_externa?.nota ?? detalhes.nota_google;
  const fonteAvaliacao = detalhes.avaliacao_externa?.fonte;
  const tempoEspera = lotacaoPercentual !== null ? calcularTempoEspera(lotacaoPercentual) : null;
  const pessoasFila = lotacaoPercentual !== null ? calcularPessoasNaFila(lotacaoPercentual) : null;
  const statusLotacao = lotacaoPercentual !== null ? calcularStatusLotacao(lotacaoPercentual) : null;
  const horarios = traduzirDiasEHorarios(detalhes.horarios);
  const extras = detalhes.geoapify_extras || {};
  const comodidades = [
    { icon: 'local-parking', label: 'Estacionamento', value: extras.estacionamento },
    { icon: 'child-care', label: 'Playground', value: extras.playground },
    { icon: 'accessible', label: 'Acessibilidade', value: extras.wheelchair },
    { icon: 'deck', label: 'Area externa', value: extras.outdoor_seating },
    { icon: 'delivery-dining', label: 'Delivery', value: extras.delivery },
    { icon: 'shopping-bag', label: 'Retirada', value: extras.takeaway },
    { icon: 'credit-card', label: 'Cartao', value: extras.aceita_cartao },
    { icon: 'event-available', label: 'Reserva', value: extras.reserva },
    { icon: 'groups', label: 'Capacidade', value: extras.capacidade },
    { icon: 'restaurant-menu', label: 'Cozinha', value: extras.cozinha },
  ]
    .map((item) => ({ ...item, texto: valorDisponibilidade(item.value) }))
    .filter((item) => item.texto);

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: imagem }} style={styles.image} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroFavButton} onPress={toggleFavorito}>
            <MaterialIcons
              name={favoritado ? 'star' : 'star-border'}
              size={25}
              color={favoritado ? '#FFD600' : INK}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{detalhes.nome}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <MaterialIcons name="star" size={16} color="#B7791F" />
              <Text style={styles.metaText}>
                {avaliacaoPrincipal ? `${avaliacaoPrincipal}${fonteAvaliacao ? ` ${fonteAvaliacao}` : ''}` : 'Sem avaliacao'}
              </Text>
            </View>
            <View style={styles.metaPill}>
              <MaterialIcons name="restaurant" size={16} color={BLUE_DARK} />
              <Text style={styles.metaText}>
                {detalhes.tipos?.[0]?.replace('_', ' ') || 'Restaurante'}
              </Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <MaterialIcons name="place" size={18} color={BLUE_DARK} />
            <Text style={styles.address}>{detalhes.endereco || 'Endereco nao informado'}</Text>
          </View>

          {lotacaoPercentual !== null && statusLotacao ? (
            <View style={styles.panel}>
              <View style={styles.statusHeader}>
                <Text style={styles.sectionTitle}>Fila e espera</Text>
                {renderLotacao(statusLotacao)}
              </View>
              <View style={styles.statusGrid}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusValue}>{pessoasFila}</Text>
                  <Text style={styles.statusLabel}>Na fila</Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusValue}>{tempoEspera}</Text>
                  <Text style={styles.statusLabel}>Tempo estimado</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Fila e espera</Text>
              <Text style={styles.info}>Lotacao indisponivel no momento.</Text>
            </View>
          )}

          <View style={styles.panel}>
            <View style={styles.reservationHeader}>
              <View style={styles.reservationHeaderText}>
                <Text style={styles.sectionTitle}>Reserva</Text>
                <Text style={styles.reservationSubtitle}>
                  Escolha data, horario e quantidade antes de abrir o WhatsApp.
                </Text>
              </View>
              <MaterialIcons name="event-available" size={28} color={BLUE_DARK} />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setModalVisible(true)}>
              <MaterialIcons name="calendar-month" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Escolher data e horario</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => irParaEvento()}>
              <MaterialIcons name="group-add" size={18} color={BLUE_DARK} />
              <Text style={styles.secondaryButtonText}>Criar evento neste restaurante</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.linkButton} onPress={abrirCardapioOuSite}>
            <MaterialIcons name="open-in-new" size={18} color={BLUE_DARK} />
            <Text style={styles.linkButtonText}>Abrir cardapio, site ou avaliacoes</Text>
          </TouchableOpacity>

          {detalhes.avaliacao_externa && (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Avaliacoes</Text>
              <Text style={styles.info}>
                {detalhes.avaliacao_externa.fonte}: {detalhes.avaliacao_externa.nota || 'Sem nota'}
                {detalhes.avaliacao_externa.total ? ` (${detalhes.avaliacao_externa.total} avaliacoes)` : ''}
              </Text>
              {detalhes.avaliacao_externa.ranking && (
                <Text style={styles.info}>{detalhes.avaliacao_externa.ranking}</Text>
              )}
              <Text style={styles.attributionText}>Dados exibidos via {detalhes.avaliacao_externa.fonte}.</Text>
            </View>
          )}

          {comodidades.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Comodidades</Text>
              <View style={styles.amenitiesGrid}>
                {comodidades.map((item) => (
                  <View key={item.label} style={styles.amenityItem}>
                    <MaterialIcons
                      name={item.icon as React.ComponentProps<typeof MaterialIcons>['name']}
                      size={18}
                      color={BLUE_DARK}
                    />
                    <View style={styles.amenityTextArea}>
                      <Text style={styles.amenityLabel}>{item.label}</Text>
                      <Text style={styles.amenityValue}>{item.texto}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.attributionText}>Algumas informacoes podem vir do Geoapify/OpenStreetMap.</Text>
            </View>
          )}

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Informacoes</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={18} color={BLUE_DARK} />
              <Text style={styles.info}>{detalhes.telefone || 'Nao disponivel'}</Text>
            </View>

            <Text style={styles.hoursTitle}>Horario de funcionamento</Text>
            {horarios.length ? (
              horarios.map((hora, i) => (
                <Text key={i} style={styles.hoursText}>{hora}</Text>
              ))
            ) : (
              <Text style={styles.info}>Horario nao informado.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <ModalReserva
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCriarEvento={({ pessoas, data }) => irParaEvento(pessoas, data)}
        placeId={placeId}
        nomeRestaurante={detalhes.nome}
        cidade="pinhais"
        capacidadeMaxima={100}
        telefoneRestaurante={detalhes.telefone || ''}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#E3F2FD', flex: 1 },
  hero: { position: 'relative' },
  image: { width: '100%', height: 260, backgroundColor: '#BBDEFB' },
  backButton: {
    position: 'absolute',
    top: 42,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFavButton: {
    position: 'absolute',
    top: 42,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, paddingBottom: 34 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: INK,
    lineHeight: 34,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: { color: INK, fontWeight: '700', fontSize: 13 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
  },
  address: { flex: 1, fontSize: 14, color: '#344054', lineHeight: 20 },
  panel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: INK },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statusItem: {
    flex: 1,
    minHeight: 72,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    padding: 12,
    justifyContent: 'center',
  },
  statusValue: { color: BLUE_DARK, fontSize: 18, fontWeight: '800' },
  statusLabel: { color: '#4B6475', fontSize: 12, marginTop: 4, fontWeight: '700' },
  lotacaoBox: {
    minHeight: 32,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lotacaoTexto: { fontSize: 12, fontWeight: '800' },
  reservationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  reservationHeaderText: { flex: 1 },
  reservationSubtitle: { color: '#4B6475', fontSize: 13, lineHeight: 18, marginTop: 3 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BLUE_DARK,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  secondaryButtonText: { color: BLUE_DARK, fontWeight: '800', fontSize: 14 },
  linkButton: {
    minHeight: 46,
    borderRadius: 8,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  linkButtonText: { color: BLUE_DARK, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  info: { fontSize: 14, color: '#344054', lineHeight: 20 },
  amenitiesGrid: {
    gap: 8,
  },
  amenityItem: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#F8FCFF',
    borderWidth: 1,
    borderColor: '#E3F2FD',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amenityTextArea: { flex: 1 },
  amenityLabel: { color: '#667085', fontSize: 12, fontWeight: '700' },
  amenityValue: { color: INK, fontSize: 13, fontWeight: '800', marginTop: 1 },
  hoursTitle: {
    marginTop: 16,
    marginBottom: 8,
    color: INK,
    fontSize: 14,
    fontWeight: '800',
  },
  hoursText: { color: '#344054', fontSize: 13, lineHeight: 20, marginBottom: 2 },
  attributionText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '700',
  },
});
