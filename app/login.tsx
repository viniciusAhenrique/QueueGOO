import { Link, useRouter } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Image, Alert, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';

export default function Login() {
    const router = useRouter();

    const retornar = () => {
        router.push('./');
    };
    
    return(
        <SafeAreaProvider>
            <SafeAreaView style={styleslogin.container}>
                <Button icon="arrow-left-circle" style={styleslogin.voltar} onPress={retornar}> </Button>
                {/*icone de voltar com seta em preto, fundo azul escuro e na superior esquerda*/}
                <Text style={styleslogin.texto}>Seja bem vindo!</Text>
                <Text style={styleslogin.texto}>Para onde vamos?</Text>
                <TextInput
                    style={styleslogin.input}
                    placeholder="Insira seu email"
                />
                <TextInput
                    style={styleslogin.input}
                    placeholder="Insira sua senha"
                />
                <Text>Esqueceu a senha?</Text>
                <Link
                    href="./login"
                    style={styleslogin.buttonlogin}
                >
                    Entrar
                </Link>
                {/*//separador, com o texto "Ou entre com"*/}
                {/*//3 botões lado a lado, com icones do facebook, google e apple*/}
                <View style={styleslogin.botoes}>
                    <Button icon="facebook" style={styleslogin.botoesapps}> </Button>
                    <Button icon="google" style={styleslogin.botoesapps}> </Button>
                    <Button icon="apple" style={styleslogin.botoesapps}> </Button>
                </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styleslogin = StyleSheet.create({
    container: {
        backgroundColor: "#4FC3F7",
        justifyContent: "center",
        height: "100%",
        paddingLeft: '5%',
    },
    buttonlogin: {
        margin: 4,
        width: '90%',
        height: '10%',
        borderRadius: 10,
        backgroundColor: '#1e232c',
        borderColor: '#000000',
        color: '#ffffff',
        textAlign: "center",
        fontFamily: 'Urbanist',
        fontSize: 15
    },
    convidado: {
        fontStyle: 'italic',
        fontWeight: 'bold',
    },
    input: {
        height: '7%',
        width: '90%',
        borderRadius: 30,
        margin: 12,
        borderWidth: 1,
        padding: 10,
        backgroundColor: '#ffffff',
    },
    voltar: {
        color: '#1e232c',
        backgroundColor: "darkblue",
    },
    botoes: {
        flex: 1,
        alignSelf: "flex-end",
        flexDirection: "row",
    },
    texto: {
        fontSize: 30,
        fontWeight: "bold",
    },
    botoesapps: {
        padding: 10,
        backgroundColor: 'white',
        borderRadius: 10,
        height: '10%',
        width: '10%',
    }
});