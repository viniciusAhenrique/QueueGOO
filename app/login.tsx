import { Link, useRouter } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet, Image, Alert, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/firebaseconfig';

export default function Login() {
	const router = useRouter();
	const [email, setEmail] = useState('');
	const [senha, setSenha] = useState('');

	const retornar = () => {
		router.push('./welcome');
	};

	const inscreverSe = () => {
		router.push('./cadastro');
	};

	const handleLogin = async () => {
		if (!email || !senha) {
			Alert.alert('Erro', 'Preencha o email e a senha.');
			return;
		}

		try {
			await signInWithEmailAndPassword(auth, email, senha);
			Alert.alert('Sucesso', 'Login realizado com sucesso!');
			router.replace('/mapa');
		} catch (error: any) {
			Alert.alert('Erro no login', error.message);
		}
	};

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.container}>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				>
					<ScrollView contentContainerStyle={styles.scroll}>
						<Button icon="arrow-left-circle" style={styles.voltar} onPress={retornar} />

						<Text style={styles.titulo}>Seja bem-vindo!</Text>
						<Text style={styles.subtitulo}>Para onde vamos?</Text>

						<TextInput
							style={styles.input}
							placeholder="Insira seu email"
							value={email}
							onChangeText={setEmail}
							autoCapitalize="none"
							keyboardType="email-address"
							placeholderTextColor="#888"
						/>
						<TextInput
							style={styles.input}
							placeholder="Insira sua senha"
							value={senha}
							onChangeText={setSenha}
							secureTextEntry
							placeholderTextColor="#888"
						/>

						<Text style={styles.esqueceu}>Esqueceu a senha?</Text>

						<Button
							onPress={handleLogin}
							labelStyle={styles.labelLogin}
							style={styles.buttonlogin}
						>
							Entrar
						</Button>

						<View style={styles.divisor}>
							<View style={styles.linha} />
							<Text style={styles.ou}>ou</Text>
							<View style={styles.linha} />
						</View>

						<View style={styles.botoes}>
							<Button icon="facebook" style={styles.botoesapps} />
							<Button icon="google" style={styles.botoesapps} />
							<Button icon="apple" style={styles.botoesapps} />
						</View>

						<View style={styles.rodape}>
							<Text style={styles.rodapeTexto1}>Não tem conta? </Text>
							<Text style={styles.rodapeTexto2} onPress={inscreverSe}>
								Inscreva-se agora
							</Text>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
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
        position: "sticky",
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
