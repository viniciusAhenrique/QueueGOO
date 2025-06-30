import React from 'react';
import { TouchableOpacity, StyleSheet, Text, SafeAreaView, View } from 'react-native';

export default function ModalRestaurante({ fecharModal, menuRestaurante } : {fecharModal:any, menuRestaurante:any}) {
    return (
        <SafeAreaView style={stylesmodal.container}>
            <TouchableOpacity style={{ flex: 1, zIndex: 9 }} onPress={fecharModal}></TouchableOpacity>

            <View style={stylesmodal.conteudo}>
                <Text style={stylesmodal.modalText}>Restaurante Madalosso</Text>
                <Text style={stylesmodal.modalText}>★ 4.8</Text>
                <TouchableOpacity style={stylesmodal.botao} onPress={menuRestaurante}>
                    <Text style={stylesmodal.texto}>Saiba mais</Text>
                </TouchableOpacity>
                <TouchableOpacity style={stylesmodal.botao} onPress={fecharModal}>
                    <Text style={stylesmodal.texto}>Fechar</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

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
