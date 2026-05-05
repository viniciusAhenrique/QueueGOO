import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import ModalReserva from './components/reserva_usuario';
import { auth } from '@/firebaseconfig';
import {
  adicionarFavorito,
  removerFavorito,
  verificarFavorito,
} from './favoritosService';
import { getPlaceDetailsUrl, getPlacePhotoUrl } from '@/config/googleApi';

// Interface para tipificar detalhes do restaurante
interface RestauranteDetalhes {
  name: string;
  rating?: number;
  types?: string[];
  photos?: { photo_reference: string }[];
  formatted_address?: string;
  formatted_phone_number?: string;
  opening_hours?: { weekday_text?: string[] };
}

interface RestauranteFavorito {
  id: string;
  placeId: string;
  nome: string;
  tipo: string;
  lotacao: number;
  foto: string | null;
}

export default function Restaurante() {
  const { placeId, lotacao } = useLocalSearchParams<{ placeId: string; lotacao?: string }>();
  const lotacaoPercentual = Number(lotacao || 0);

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
      const url = getPlaceDetailsUrl(placeId);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.result) {
        setDetalhes(data.result);
      } else {
        Alert.alert('Erro', 'Informações do restaurante não encontradas.');
        console.warn('Detalhes não encontrados para placeId:', placeId);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do restaurante:', error);
      Alert.alert('Erro', 'Não foi possível carregar as informações do restaurante.');
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
      Alert.alert('Acesso Negado', 'Você precisa estar logado para adicionar favoritos.');
      return;
    }
    
    if (!detalhes || !placeId) {
      Alert.alert('Erro', 'Informações do restaurante não carregadas.');
      return;
    }

    try {
      const restaurante: RestauranteFavorito = {
        id: placeId,
        placeId: placeId,
        nome: detalhes.name,
        tipo: detalhes.types?.[0]?.replace('_', ' ') || 'Restaurante',
        lotacao: lotacaoPercentual,
        foto: detalhes.photos?.[0]?.photo_reference
          ? obterUrlImagem(detalhes.photos[0].photo_reference)
          : null,
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
      Alert.alert('Erro', 'Não foi possível atualizar os favoritos.');
    }
  };

  const obterUrlImagem = (photoRef: string): string =>
    getPlacePhotoUrl(photoRef, 800);

  const calcularTempoEspera = (lot: number): string => {
    if (lot > 80) return '30–50 min';
    if (lot >= 40) return '15–30 min';
    return '5–15 min';
  };

  const calcularPessoasNaFila = (lot: number): string => {
    if (lot > 80) return '+30 pessoas';
    if (lot >= 40) return '10–30 pessoas';
    return 'menos de 10';
  };

  const calcularStatusLotacao = (lot: number): 'baixa' | 'media' | 'alta' => {
    if (lot > 80) return 'alta';
    if (lot >= 40) return 'media';
    return 'baixa';
  };

  const traduzirDiasEHorarios = (horariosTexto: string[] | undefined): string[] => {
    if (!horariosTexto) return [];

    const traducaoDias: { [key: string]: string } = {
      'Monday': 'Segunda-feira',
      'Tuesday': 'Terça-feira',
      'Wednesday': 'Quarta-feira',
      'Thursday': 'Quinta-feira',
      'Friday': 'Sexta-feira',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo',
    };

    const converterPara24h = (hora: string): string => {
      const regex = /(\d{1,2}):(\d{2})\s(AM|PM)/gi;
      return hora.replace(regex, (match, horas, minutos, periodo) => {
        let h = parseInt(horas, 10);
        const m = minutos;
        
        if (periodo.toUpperCase() === 'PM' && h !== 12) {
          h += 12;
        } else if (periodo.toUpperCase() === 'AM' && h === 12) {
          h = 0;
        }
        
        return `${String(h).padStart(2, '0')}:${m}`;
      });
    };

    return horariosTexto.map((horario) => {
      let texto = horario;
      // Traduzir dias
      for (const [inglês, português] of Object.entries(traducaoDias)) {
        texto = texto.replace(new RegExp(`^${inglês}`, 'i'), português);
      }
      // Converter para 24h
      texto = converterPara24h(texto);
      return texto;
    });
  };

  const renderLotacao = (nivel: 'baixa' | 'media' | 'alta') => {
    const cores = { baixa: '#2E7D32', media: '#F9A825', alta: '#C62828' } as const;
    const icones = { baixa: 'check-circle', media: 'error', alta: 'warning' } as const;
    const textos = { baixa: 'Lotação Baixa', media: 'Lotação Média', alta: 'Lotação Alta' } as const;

    return (
      <View style={styles.lotacaoBox}>
        <MaterialIcons name={icones[nivel]} size={20} color={cores[nivel]} />
        <Text style={[styles.lotacaoTexto, { color: cores[nivel], marginLeft: 6 }]}>
          {textos[nivel]}
        </Text>
      </View>
    );
  };

  if (!placeId) return <Text style={{ padding: 20 }}>Restaurante não encontrado.</Text>;
  if (loading) return <ActivityIndicator size="large" color="#4FC3F7" style={{ marginTop: 50 }} />;
  if (!detalhes) return <Text style={{ padding: 20 }}>Erro ao carregar dados.</Text>;

  const imagem = detalhes.photos?.[0]?.photo_reference
    ? obterUrlImagem(detalhes.photos[0].photo_reference)
    : 'https://via.placeholder.com/800x400.png?text=Imagem+Indispon%C3%ADvel';

  const tempoEspera = calcularTempoEspera(lotacaoPercentual);
  const pessoasFila = calcularPessoasNaFila(lotacaoPercentual);
  const statusLotacao = calcularStatusLotacao(lotacaoPercentual);

  return (
    <>
      <ScrollView style={styles.container}>
        <Image source={{ uri: imagem }} style={styles.image} />
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>{detalhes.name}</Text>
            <TouchableOpacity style={styles.favButton} onPress={toggleFavorito}>
              <MaterialIcons
                name={favoritado ? 'star' : 'star-border'}
                size={30}
                color={favoritado ? '#FFD600' : '#999'}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.rating}>⭐ {detalhes.rating || 'Sem avaliação'}</Text>
          <Text style={styles.type}>{detalhes.types?.[0]?.replace('_', ' ') || 'Restaurante'}</Text>
          <Text style={styles.address}>{detalhes.formatted_address}</Text>

          <View style={styles.filaContainer}>
            <Text style={styles.filaTitulo}>📍 Fila e Espera</Text>
            <Text style={styles.filaTexto}>👥 Pessoas na fila: {pessoasFila}</Text>
            <Text style={styles.filaTexto}>⏳ Tempo estimado: {tempoEspera}</Text>
            {renderLotacao(statusLotacao)}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={() => Alert.alert('Cardápio indisponível')}>
              <Text style={styles.buttonText}>Ver Cardápio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
              <Text style={styles.buttonText}>Reservar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Telefone:</Text>
          <Text style={styles.info}>{detalhes.formatted_phone_number || 'Não disponível'}</Text>

          <Text style={styles.sectionTitle}>Horário de Funcionamento:</Text>
          {traduzirDiasEHorarios(detalhes.opening_hours?.weekday_text).map((hora, i) => (
            <Text key={i} style={styles.info}>{hora}</Text>
          ))}
        </View>
      </ScrollView>

      <ModalReserva
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        placeId={placeId}
        nomeRestaurante={detalhes.name}
        cidade="pinhais"
        capacidadeMaxima={100}
        telefoneRestaurante={detalhes.formatted_phone_number || ''}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#E3F2FD', flex: 1 },
  image: { width: '100%', height: 220 },
  content: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0D47A1',
    flex: 1,
    marginRight: 10,
  },
  favButton: {
    padding: 6,
  },
  rating: { fontSize: 16, color: '#FFA000', marginTop: 4 },
  type: { fontSize: 14, color: '#555', marginBottom: 4 },
  address: { fontSize: 14, color: '#444', marginBottom: 10 },
  sectionTitle: { marginTop: 18, fontSize: 18, fontWeight: '600', color: '#1976D2' },
  info: { fontSize: 14, color: '#333', marginBottom: 2 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  button: { backgroundColor: '#0288D1', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  filaContainer: { marginTop: 20, padding: 12, borderRadius: 8, backgroundColor: '#BBDEFB' },
  filaTitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 6, color: '#0D47A1' },
  filaTexto: { fontSize: 14, color: '#1A237E', marginBottom: 2 },
  lotacaoBox: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  lotacaoTexto: { fontSize: 14, fontWeight: 'bold' },
});
