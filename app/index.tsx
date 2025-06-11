import { Link } from 'expo-router';
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';


export default function App() {
    return(
        <View style={stylesinicio.container}>
            <Image source={require("../assets/images/logo-queuego.png")} style={{ width: "70%", height: "60%" }}/>
            <Link
                href="./login"
                style={stylesinicio.buttonlogin}
            >
                Entrar
            </Link>
            <Link
                href="./cadastro"
                style={stylesinicio.buttoncadastro}
            >
                Cadastrar
            </Link>
            <Link style={stylesinicio.convidado} href="./mapa">Continuar como convidado</Link>
        </View>
    );
}

const stylesinicio = StyleSheet.create({
    container: {
        backgroundColor: "#4FC3F7",
        justifyContent: "center",
        alignItems: "center",
    },
    buttonlogin: {
        margin: 4,
        width: '80%',
        height: '10%',
        borderRadius: 10,
        backgroundColor: '#1e232c',
        borderColor: '#000000',
        color: '#ffffff',
        textAlign: "center",
        fontFamily: 'Urbanist',
        fontSize: 15
    },
    buttoncadastro: {
        margin: 4,
        width: '80%',
        height: '10%',
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        color: '#000000',
        textAlign: "center",
        fontFamily: 'Urbanist',
        fontSize: 15
    },
    convidado: {
        textDecorationLine: 'underline',
        fontWeight: 'bold',
        fontFamily: 'Urbanist',
        fontSize: 15
    }
});