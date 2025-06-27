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

const stylesmodal = StyleSheet.create({
    container: {
        flex: 1,
    },
    conteudo: {
        marginVertical: 20,
        marginLeft: 10,
        marginRight: 10,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
        width: 0,
        height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    botao: {
        zIndex: 99,
        backgroundColor: '#ffffff',
        borderRadius: 6,
        marginTop: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0, 0.2)',
        shadowColor: 'rgba(0,0,0, 0.5)',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        elevation: 5,
        shadowOpacity: 0.28,
        shadowRadius: 4,
    },
    texto: {
        textAlign: 'center',
        fontWeight: 'bold',
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
    },
})