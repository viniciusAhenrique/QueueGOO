import { Link, useRouter } from 'expo-router';
import React = require("react");
import { View, Text, StyleSheet, Image, Alert, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';

export default function Login() {

    const router = useRouter();

    const retornar = () => {
        router.push('./welcome');
    };

    const inscreverSe = () => {
        router.push('./cadastro');
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
                    <Button 
                        icon="facebook" 
                        labelStyle={{ fontSize: 40 }} 
                        style={styleslogin.botoesapps}
                        contentStyle={{ paddingLeft: 20 }}
                    > </Button>
                    <Button 
                        icon="google" 
                        labelStyle={{ fontSize: 40 }} 
                        style={styleslogin.botoesapps}
                        contentStyle={{ paddingLeft: 20 }}
                    > </Button>
                    <Button
                        icon="apple" 
                        labelStyle={{ fontSize: 40 }}  
                        style={styleslogin.botoesapps}
                        contentStyle={{ paddingLeft: 20 }}
                    > </Button>
                </View>
                <View style={styleslogin.textoRodapeContainer}>
                    <Text style={styleslogin.textoRodape1}>Não tem conta? </Text>
                    <Text style={styleslogin.textoRodape2} onPress={inscreverSe}>Inscreva-se agora</Text>
                </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styleslogin = StyleSheet.create({
    container: {
        backgroundColor: "#4FC3F7",
        flex: 1,
        flexDirection: "column",
        justifyContent: "space-around",
        alignItems: "center",
        height: "100%",
        paddingLeft: '5%',
    },
    buttonlogin: {
        margin: 4,
        width: '90%',
        height: '7%',
        borderRadius: 10,
        backgroundColor: '#1e232c',
        borderColor: '#000000',
        borderWidth: 1,
        color: '#ffffff',
        textAlign: "center",
        fontFamily: 'Urbanist_600SemiBold',
        fontSize: 18,
        justifyContent: "center",
    },
    input: {
        height: '7%',
        width: '90%',
        borderRadius: 30,
        margin: 12,
        borderWidth: 1,
        padding: 10,
        backgroundColor: '#ffffff',
        fontFamily: 'Urbanist_500Medium',
    },
    voltar: {
        color: '#1e232c',
        backgroundColor: "darkblue",
        alignSelf: "flex-start",
    },
    botoes: {
        flex: 1,
        alignItems: "center",
        padding: "10%",
        justifyContent: "space-around",
        flexDirection: "row",
        gap: 30,
        position: "static",
        height: '10%',
    },
    texto: {
        fontSize: 30,
        fontFamily: 'Poppins_700Bold',
        alignSelf: "flex-start",
    },
    botoesapps: {
        backgroundColor: 'white',
        borderRadius: 10,
        height: '20%',
        width: '20%',
        justifyContent: "center",
        alignItems: "center",
    },
    textoRodape1: {
        fontSize: 15,
        fontFamily: 'Urbanist_500Medium',
        color: '#1E232C',
    },
    textoRodape2: {
        fontSize: 15,
        fontFamily: 'Urbanist_700Bold',
        color: '#0663EF',
    },
    textoRodapeContainer: {
        paddingBottom: 20,
        flexDirection: "row",
    },
});