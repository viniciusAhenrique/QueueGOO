import { Link } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import { Button } from 'react-native-paper';


export default function Login() {
    return(
        <View style={stylesinicio.container}>
            <Image source={require("../assets/images/logo-queuego.png")} style={{ width: "70%", height: "60%" }}/>
            <Text>Tela em construção</Text>
        </View>
    );
}

const stylesinicio = StyleSheet.create({
    container: {
        backgroundColor: "#4FC3F7",
    },
    buttonlogin: {
        margin: 4,
        width: '80%',
        color: '#1e232c',
        borderColor: 'black',
    },
    buttoncadastro: {
        margin: 4,
        width: '80%',
        color: 'white',
        borderColor: 'black',
    },
    convidado: {
        fontStyle: 'italic',
        fontWeight: 'bold',
    }
});