import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Alert,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
} from 'react-native';
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#4FC3F7',
	},
	scroll: {
		flexGrow: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 25,
		paddingBottom: 30,
	},
	voltar: {
		backgroundColor: 'darkblue',
		alignSelf: 'flex-start',
		marginBottom: 20,
	},
	titulo: {
		fontSize: 28,
		fontFamily: 'Poppins_700Bold',
		color: '#1e232c',
		alignSelf: 'flex-start',
	},
	subtitulo: {
		fontSize: 22,
		fontFamily: 'Urbanist_500Medium',
		color: '#1e232c',
		marginBottom: 20,
		alignSelf: 'flex-start',
	},
	input: {
		height: 52,
		width: '100%',
		borderRadius: 12,
		marginBottom: 14,
		paddingHorizontal: 15,
		backgroundColor: '#ffffff',
		borderColor: '#d1d1d1',
		borderWidth: 1,
		fontFamily: 'Urbanist_500Medium',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.07,
		shadowRadius: 3,
		elevation: 2,
	},
	esqueceu: {
		alignSelf: 'flex-end',
		marginBottom: 20,
		color: '#0663EF',
		fontFamily: 'Urbanist_500Medium',
	},
	buttonlogin: {
		width: '100%',
		height: 52,
		borderRadius: 12,
		justifyContent: 'center',
		backgroundColor: '#1e232c',
		marginBottom: 30,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	labelLogin: {
		fontSize: 16,
		color: 'white',
		fontFamily: 'Urbanist_600SemiBold',
	},
	divisor: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 20,
		width: '100%',
	},
	linha: {
		flex: 1,
		height: 1,
		backgroundColor: '#ccc',
	},
	ou: {
		marginHorizontal: 10,
		color: '#555',
		fontFamily: 'Urbanist_500Medium',
	},
	botoes: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		width: '100%',
		marginBottom: 30,
	},
	botoesapps: {
		backgroundColor: '#ffffff',
		borderRadius: 10,
		height: 60,
		width: 60,
		justifyContent: 'center',
		alignItems: 'center',
		elevation: 2,
	},
	rodape: {
		flexDirection: 'row',
		justifyContent: 'center',
	},
	rodapeTexto1: {
		fontSize: 15,
		fontFamily: 'Urbanist_500Medium',
		color: '#1E232C',
	},
	rodapeTexto2: {
		fontSize: 15,
		fontFamily: 'Urbanist_700Bold',
		color: '#0663EF',
	},
});
