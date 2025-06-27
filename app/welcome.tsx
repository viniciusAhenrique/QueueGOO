import { Link, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { SafeAreaView, View, StyleSheet, Image, Text, ActivityIndicator } from 'react-native';
import { Button } from 'react-native-paper';

export default function Welcome() {

    const router = useRouter();
  
    const acessarLogin = () => {
      router.push('./login');
    };

    const acessarCadastro = () => {
      router.push('./cadastro');
    };

    const acessarConvidado = () => {
      router.push('./mapa');
    };

    return(
        <SafeAreaView style={stylesinicio.container}>
            <Image source={require("../assets/images/logo-queuego.png")} style={{ width: "95%", height: "50%" }}/>
            <Button
                onPress={acessarLogin}
                labelStyle={{ fontSize: 18, fontFamily: 'Urbanist_600SemiBold' }}
                style={stylesinicio.buttonlogin}
                textColor='#ffffff'
            >
              Entrar
            </Button>
            <Button
                onPress={acessarCadastro}
                labelStyle={{ fontSize: 18, fontFamily: 'Urbanist_600SemiBold' }}
                style={stylesinicio.buttoncadastro}
                textColor='#000000'
            >
              Cadastrar
            </Button>
            <Text style={stylesinicio.convidado} onPress={acessarConvidado}>Continuar como convidado</Text>
        </SafeAreaView>
    );
}

const stylesinicio = StyleSheet.create({
    container: {
        backgroundColor: "#4FC3F7",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
    },
    buttonlogin: {
        margin: 4,
        width: '90%',
        height: '7%',
        borderRadius: 10,
        backgroundColor: '#1e232c',
        borderColor: '#000000',
        borderWidth: 1,
        justifyContent: "center",
    },
    buttoncadastro: {
        margin: 4,
        marginTop: 10,
        marginBottom: 50,
        width: '90%',
        height: '7%',
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 1,
        justifyContent: "center",
    },
    convidado: {
        textDecorationLine: 'underline',
        fontFamily: 'Urbanist_700Bold',
        fontSize: 15
    },
});