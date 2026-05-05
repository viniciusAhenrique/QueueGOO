import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface BalaoRestauranteProps {
  nome: string;
  tipo: string;
  lotacao: number | null;
  exibirLotacao?: boolean;
  placeId: string;
  foto: string | null;
  onClose: () => void;
}

const BalaoRestaurante: React.FC<BalaoRestauranteProps> = ({
  nome,
  tipo,
  lotacao,
  exibirLotacao = true,
  placeId,
  foto,
  onClose,
}) => {
  const router = useRouter();

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

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityLabel="Fechar balao"
        >
          <MaterialIcons name="close" size={20} color="#666" />
        </TouchableOpacity>

        <Image
          source={{ uri: foto ?? 'https://via.placeholder.com/300x150?text=Restaurante' }}
          style={styles.imagem}
          resizeMode="cover"
        />

        <View style={styles.conteudo}>
          <Text style={styles.titulo} numberOfLines={1} ellipsizeMode="tail">
            {nome}
          </Text>
          <Text style={styles.subtitulo}>{tipo}</Text>

          {exibirLotacao && lotacao !== null && (
            <>
              <View style={styles.infoContainer}>
                <Text style={styles.infoTexto}>
                  Lotacao: <Text style={styles.destaque}>{lotacao}%</Text>
                </Text>
                <Text style={styles.infoTexto}> - Espera: {calcularTempoEspera(lotacao)}</Text>
              </View>

              <Text style={styles.infoFila}>
                Fila estimada: <Text style={styles.destaque}>{calcularPessoasNaFila(lotacao)}</Text>
              </Text>
            </>
          )}

          {exibirLotacao && lotacao === null && (
            <Text style={styles.infoFila}>Lotacao indisponivel no momento.</Text>
          )}

          <TouchableOpacity
            style={styles.botao}
            onPress={() =>
              router.push({
                pathname: '/screens/restaurante',
                params: {
                  placeId,
                  ...(lotacao !== null ? { lotacao: lotacao.toString() } : {}),
                },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Saiba mais sobre ${nome}`}
          >
            <Text style={styles.botaoTexto}>Saiba mais</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.seta} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    width: '100%',
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 6,
    elevation: 3,
  },
  imagem: {
    width: '100%',
    height: 140,
  },
  conteudo: {
    padding: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  infoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 6,
  },
  infoTexto: {
    fontSize: 14,
    color: '#444',
  },
  infoFila: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
  },
  destaque: {
    fontWeight: 'bold',
    color: '#0D47A1',
  },
  botao: {
    backgroundColor: '#0D47A1',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignSelf: 'center',
  },
  botaoTexto: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  seta: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderLeftColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'transparent',
    borderTopWidth: 10,
    borderTopColor: '#fff',
    marginTop: -1,
  },
});

export default BalaoRestaurante;
