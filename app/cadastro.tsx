import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { auth, db } from '@/firebaseconfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');

  const retornar = () => {
    router.push('/welcome');
  };

  const logarSe = () => {
    router.push('/login');
  };

  const handleCadastrar = async () => {
    if (!nome || !email || !senha || !confirmSenha) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    if (senha !== confirmSenha) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);

      await updateProfile(userCredential.user, {
        displayName: nome,
      });

      await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
        nome,
        email,
        criadoEm: new Date(),
      });

      Alert.alert('Sucesso', 'Cadastro realizado!');
      router.push('/login');
    } catch (error: any) {
      let mensagem = 'Erro no cadastro. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        mensagem = 'Este e-mail já está em uso.';
      } else if (error.code === 'auth/invalid-email') {
        mensagem = 'E-mail inválido.';
      } else if (error.code === 'auth/weak-password') {
        mensagem = 'Senha muito fraca.';
      }
      Alert.alert('Erro', mensagem);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.inner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll}>
            <Button
              icon="arrow-left-circle"
              style={styles.voltar}
              onPress={retornar}
            >
              Voltar
            </Button>

            <Text style={styles.titulo}>Olá! Se inscreva para começar</Text>

            <TextInput
              style={styles.input}
              placeholder="Nome de usuário"
              value={nome}
              onChangeText={setNome}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmar senha"
              secureTextEntry
              value={confirmSenha}
              onChangeText={setConfirmSenha}
              placeholderTextColor="#888"
            />

            <Button
              mode="contained"
              onPress={handleCadastrar}
              style={styles.botaoRegistrar}
              labelStyle={{ fontSize: 16, fontFamily: 'Urbanist_600SemiBold' }}
            >
              Registrar
            </Button>

            <View style={styles.textoRodapeContainer}>
              <Text style={styles.textoRodape1}>Já tem uma conta? </Text>
              <Text style={styles.textoRodape2} onPress={logarSe}>
                Entre agora
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
    backgroundColor: "#4FC3F7",
  },
  inner: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingBottom: 30,
  },
  voltar: {
    backgroundColor: "darkblue",
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  titulo: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 20,
    color: "#1e232c",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  botaoRegistrar: {
    marginTop: 15,
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#1e232c',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textoRodapeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
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
});
