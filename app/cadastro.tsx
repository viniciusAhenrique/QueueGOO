import { Link, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Image, Alert, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import React = require('react');


export default function Cadastro() {
    const router = useRouter();

    const retornar = () => {
        router.push('./welcome');
    };

    const logarSe = () => {
        router.push('./login');
    };

    return(
        <SafeAreaProvider>
            <SafeAreaView style={stylescadastro.container}>
                <Button icon="arrow-left-circle" style={stylescadastro.voltar} onPress={retornar}> </Button>
                {/*icone de voltar com seta em preto, fundo azul escuro e na superior esquerda*/}
                <Text style={stylescadastro.texto}>Olá! Se inscreva para começar</Text>
                <TextInput
                    style={stylescadastro.input}
                    placeholder="Nome de usuário"
                />
                <TextInput
                    style={stylescadastro.input}
                    placeholder="E-mail"
                />
                <TextInput
                    style={stylescadastro.input}
                    placeholder="Senha"
                />
                <TextInput
                    style={stylescadastro.input}
                    placeholder="Confirmar senha"
                />
                <Link
                    href="./login"
                    style={stylescadastro.buttonlogin}
                >
                    Registrar
                </Link>
                <View style={stylescadastro.textoRodapeContainer}>
                    <Text style={stylescadastro.textoRodape1}>Já tem uma conta? </Text>
                    <Text style={stylescadastro.textoRodape2} onPress={logarSe}>Entre agora</Text>
                </View>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const stylescadastro = StyleSheet.create({
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
    texto: {
        fontSize: 30,
        fontFamily: 'Poppins_700Bold',
        alignSelf: "flex-start",
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