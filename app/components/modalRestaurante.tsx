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
  destaqueQmesa?: boolean;
  movimentoAtual?: string | null;
  recomendacaoVisita?: string | null;
  mesasLivres?: number | null;
  capacidadeTotal?: number | null;
  onClose: () => void;
}

const BalaoRestaurante: React.FC<BalaoRestauranteProps> = ({
  nome,
  tipo,
  lotacao,
  exibirLotacao = true,
  placeId,
  foto,
  destaqueQmesa = false,
  movimentoAtual,
  recomendacaoVisita,
  mesasLivres,
  capacidadeTotal,
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

        {foto ? (
          <Image source={{ uri: foto }} style={styles.imagem} resizeMode="cover" />
        ) : (
          <View style={styles.imagemFallback}>
            <MaterialIcons name="restaurant" size={34} color="#0D47A1" />
            <Text style={styles.fallbackText}>Sem foto disponivel</Text>
          </View>
        )}

        <View style={styles.conteudo}>
          {destaqueQmesa && (
            <View style={styles.qmesaBadge}>
              <MaterialIcons name="verified" size={15} color="#FFFFFF" />
              <Text style={styles.qmesaBadgeText}>Parceiro Qmesa ao vivo</Text>
            </View>
          )}

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

          {destaqueQmesa && (
            <View style={styles.qmesaPanel}>
              {movimentoAtual ? (
                <Text style={styles.qmesaInfo}>Movimento agora: {movimentoAtual}</Text>
              ) : null}
              {typeof mesasLivres === 'number' ? (
                <Text style={styles.qmesaInfo}>Mesas livres: {mesasLivres}</Text>
              ) : null}
              {recomendacaoVisita ? (
                <Text style={styles.qmesaHint}>{recomendacaoVisita}</Text>
              ) : null}
            </View>
          )}

          {exibirLotacao && lotacao === null && (
            <Text style={styles.infoFila}>Lotacao indisponivel no momento.</Text>
          )}

          <TouchableOpacity
            style={styles.botao}
            onPress={() => {
              onClose();
              router.push({
                pathname: '/screens/restaurante',
                params: {
                  placeId,
                  ...(lotacao !== null ? { lotacao: lotacao.toString() } : {}),
                  ...(destaqueQmesa
                    ? {
                        origemQmesa: '1',
                        nome,
                        tipo,
                        movimentoAtual: movimentoAtual || '',
                        recomendacaoVisita: recomendacaoVisita || '',
                        mesasLivres:
                          typeof mesasLivres === 'number' ? String(mesasLivres) : '',
                        capacidadeTotal:
                          typeof capacidadeTotal === 'number' ? String(capacidadeTotal) : '',
                      }
                    : {}),
                },
              });
            }}
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
    borderRadius: 8,
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
    height: 112,
  },
  imagemFallback: {
    width: '100%',
    height: 96,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fallbackText: {
    color: '#0D47A1',
    fontSize: 12,
    fontWeight: '800',
  },
  conteudo: {
    padding: 12,
  },
  qmesaBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: '#FF9500',
    paddingHorizontal: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  qmesaBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  titulo: {
    fontSize: 18,
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
  qmesaPanel: {
    borderRadius: 8,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: '#FFD18A',
    padding: 10,
    marginBottom: 12,
    gap: 3,
  },
  qmesaInfo: {
    color: '#7A3E00',
    fontSize: 13,
    fontWeight: '800',
  },
  qmesaHint: {
    color: '#7A3E00',
    fontSize: 13,
    lineHeight: 18,
  },
  destaque: {
    fontWeight: 'bold',
    color: '#0D47A1',
  },
  botao: {
    backgroundColor: '#0D47A1',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: 'center',
  },
  botaoTexto: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  seta: {
    display: 'none',
  },
});

export default BalaoRestaurante;
