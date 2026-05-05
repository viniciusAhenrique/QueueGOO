import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/firebaseconfig';
import { sincronizarPrimeiroAcesso } from '@/src/services/authServices';
import { isValidEmail, normalizeEmail } from '@/src/utils/validation';

const BLUE = '#4FC3F7';
const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';
const extra = Constants.expoConfig?.extra || {};
const googleConfigurado = Boolean(
  extra.googleWebClientId || extra.googleAndroidClientId || extra.googleIosClientId,
);

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !senha) {
      Alert.alert('Erro', 'Preencha o email e a senha.');
      return;
    }

    setLoading(true);
    try {
      const emailLimpo = normalizeEmail(email);
      if (!isValidEmail(emailLimpo)) {
        Alert.alert('Email invalido', 'Digite um email valido para entrar.');
        return;
      }

      await signInWithEmailAndPassword(auth, emailLimpo, senha);
      await sincronizarPrimeiroAcesso();
      router.replace('/screens/mapa');
    } catch (error: any) {
      Alert.alert('Erro no login', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    Alert.alert(
      'Google em configuracao',
      'Removi temporariamente o fluxo que quebrava o app. Para ativar Google sem erro nativo, precisamos usar uma versao compativel do Auth Session ou um dev build com os modulos nativos instalados.',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/screens/welcome')}>
              <MaterialIcons name="arrow-back" size={22} color={INK} />
            </TouchableOpacity>
          </View>

          <View style={styles.brand}>
            <Image
              source={require('../../assets/images/logo-queuego.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Entrar no QueueGOO</Text>
            <Text style={styles.subtitle}>Veja restaurantes, reservas e eventos perto de voce.</Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputShell}>
                <MaterialIcons name="mail-outline" size={20} color={BLUE_DARK} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor="#7A8B99"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputShell}>
                <MaterialIcons name="lock-outline" size={20} color={BLUE_DARK} />
                <TextInput
                  style={styles.input}
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Sua senha"
                  placeholderTextColor="#7A8B99"
                  secureTextEntry={!mostrarSenha}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setMostrarSenha((value) => !value)}>
                  <MaterialIcons
                    name={mostrarSenha ? 'visibility-off' : 'visibility'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Entrar</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            {googleConfigurado && (
              <TouchableOpacity
                style={[styles.googleButton, loading && styles.disabled]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <MaterialIcons name="g-translate" size={19} color={INK} />
                <Text style={styles.googleButtonText}>Entrar com Google</Text>
              </TouchableOpacity>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Nao tem conta?</Text>
              <TouchableOpacity onPress={() => router.push('/screens/cadastro')}>
                <Text style={styles.footerLink}>Criar cadastro</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BLUE,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  topBar: {
    paddingTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  brand: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  logo: {
    width: 210,
    height: 118,
  },
  title: {
    marginTop: 8,
    color: INK,
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    color: '#234558',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Urbanist_500Medium',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    shadowColor: '#0D47A1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: INK,
    fontSize: 13,
    fontFamily: 'Urbanist_700Bold',
    marginBottom: 7,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#F8FCFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: INK,
    fontSize: 15,
    fontFamily: 'Urbanist_500Medium',
  },
  loginButton: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist_700Bold',
    fontSize: 16,
  },
  googleButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleButtonText: {
    color: INK,
    fontFamily: 'Urbanist_700Bold',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.7,
  },
  footerRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: {
    color: '#536675',
    fontFamily: 'Urbanist_500Medium',
  },
  footerLink: {
    color: BLUE_DARK,
    fontFamily: 'Urbanist_700Bold',
  },
});
