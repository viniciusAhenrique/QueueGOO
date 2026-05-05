import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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

import { auth, db } from '@/firebaseconfig';
import { sincronizarPrimeiroAcesso } from '@/src/services/authServices';
import { extensaoDaImagem, uploadImagemLocal } from '@/src/services/uploadServices';
import { isValidEmail, normalizeEmail } from '@/src/utils/validation';

type FotoCadastro = {
  uri: string;
  mimeType: string;
};

const BLUE = '#4FC3F7';
const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmSenha, setMostrarConfirmSenha] = useState(false);
  const [foto, setFoto] = useState<FotoCadastro | null>(null);
  const [loading, setLoading] = useState(false);

  const escolherFoto = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissao necessaria', 'Libere acesso a galeria para escolher sua foto.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    const asset = resultado.assets?.[0];
    if (resultado.canceled || !asset?.uri) return;

    setFoto({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  };

  const enviarFotoPerfil = async (uid: string) => {
    if (!foto) return null;

    const extensao = extensaoDaImagem(foto.mimeType);
    return uploadImagemLocal(`usuarios/${uid}/perfil.${extensao}`, foto.uri, foto.mimeType);
  };

  const handleCadastrar = async () => {
    const nomeLimpo = nome.trim();
    const emailLimpo = normalizeEmail(email);

    if (!nomeLimpo || !emailLimpo || !senha || !confirmSenha) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    if (!isValidEmail(emailLimpo)) {
      Alert.alert('Email invalido', 'Digite um email valido para criar a conta.');
      return;
    }

    if (senha !== confirmSenha) {
      Alert.alert('Erro', 'As senhas nao coincidem.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
      let fotoUrl: string | null = null;
      let fotoBloqueada = false;

      try {
        fotoUrl = await enviarFotoPerfil(userCredential.user.uid);
      } catch (error) {
        fotoBloqueada = true;
        console.error('Erro ao enviar foto no cadastro:', error);
      }

      await updateProfile(userCredential.user, {
        displayName: nomeLimpo,
        photoURL: fotoUrl || undefined,
      });

      await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
        nome: nomeLimpo,
        email: emailLimpo,
        emailLower: emailLimpo,
        fotoUrl,
        telefone: '',
        cidade: '',
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      });

      await sincronizarPrimeiroAcesso();

      Alert.alert(
        'Cadastro criado',
        fotoBloqueada
          ? 'Sua conta foi criada. A foto sera enviada assim que as regras do Storage forem publicadas.'
          : 'Sua conta esta pronta.',
      );
      router.replace('/screens/mapa');
    } catch (error: any) {
      let mensagem = 'Erro no cadastro. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        mensagem = 'Este email ja esta em uso.';
      } else if (error.code === 'auth/invalid-email') {
        mensagem = 'Email invalido.';
      } else if (error.code === 'auth/weak-password') {
        mensagem = 'Senha muito fraca.';
      }
      Alert.alert('Erro', mensagem);
    } finally {
      setLoading(false);
    }
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/screens/welcome')}>
            <MaterialIcons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Monte seu perfil para reservar, comentar e criar eventos.</Text>
          </View>

          <TouchableOpacity style={styles.avatarPicker} onPress={escolherFoto} disabled={loading}>
            {foto?.uri ? (
              <Image source={{ uri: foto.uri }} style={styles.avatarPreview} />
            ) : (
              <View style={styles.avatarEmpty}>
                <MaterialIcons name="add-a-photo" size={28} color={BLUE_DARK} />
              </View>
            )}
            <View style={styles.avatarText}>
              <Text style={styles.avatarTitle}>{foto ? 'Foto selecionada' : 'Escolher foto de perfil'}</Text>
              <Text style={styles.avatarSubtitle}>Imagem quadrada, clara e atual.</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.panel}>
            <ProfileInput
              label="Nome"
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome"
              editable={!loading}
            />
            <ProfileInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
            <ProfileInput
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              placeholder="Minimo 6 caracteres"
              secureTextEntry={!mostrarSenha}
              rightIcon={mostrarSenha ? 'visibility-off' : 'visibility'}
              onRightIconPress={() => setMostrarSenha((value) => !value)}
              editable={!loading}
            />
            <ProfileInput
              label="Confirmar senha"
              value={confirmSenha}
              onChangeText={setConfirmSenha}
              placeholder="Repita sua senha"
              secureTextEntry={!mostrarConfirmSenha}
              rightIcon={mostrarConfirmSenha ? 'visibility-off' : 'visibility'}
              onRightIconPress={() => setMostrarConfirmSenha((value) => !value)}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleCadastrar}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Criar conta</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Ja tem conta?</Text>
              <TouchableOpacity onPress={() => router.push('/screens/login')} disabled={loading}>
                <Text style={styles.footerLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ProfileInputProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  rightIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
  onRightIconPress?: () => void;
};

function ProfileInput({ label, style, rightIcon, onRightIconPress, ...props }: ProfileInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput {...props} style={[styles.input, style]} placeholderTextColor="#7A8B99" />
        {rightIcon && (
          <TouchableOpacity style={styles.inputIconButton} onPress={onRightIconPress}>
            <MaterialIcons name={rightIcon} size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  header: {
    marginTop: 18,
    marginBottom: 16,
  },
  title: {
    color: INK,
    fontSize: 30,
    fontFamily: 'Poppins_700Bold',
  },
  subtitle: {
    marginTop: 5,
    color: '#234558',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Urbanist_500Medium',
  },
  avatarPicker: {
    minHeight: 92,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarPreview: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E3F2FD',
  },
  avatarEmpty: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    flex: 1,
  },
  avatarTitle: {
    color: INK,
    fontSize: 15,
    fontFamily: 'Urbanist_700Bold',
  },
  avatarSubtitle: {
    marginTop: 3,
    color: '#536675',
    fontSize: 13,
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
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: INK,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'Urbanist_500Medium',
  },
  inputIconButton: {
    width: 44,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Urbanist_700Bold',
    fontSize: 16,
  },
  disabledButton: {
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
