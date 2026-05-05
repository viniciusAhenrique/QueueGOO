import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, updatePassword, updateProfile, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PostCard, { PostItem } from '@/app/components/PostCard';
import PostComposerModal from '@/app/components/PostComposerModal';
import { auth, db } from '@/firebaseconfig';
import { avatarFallback, formatarDataCurta } from '@/src/services/socialServices';
import { extensaoDaImagem, uploadImagemLocal } from '@/src/services/uploadServices';
import { formatBrazilianPhone, isValidPhone } from '@/src/utils/validation';

type UserProfile = {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  dataCriacao: string;
  fotoUrl: string | null;
};

type AmigoResumo = {
  uid: string;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function Perfil() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [composerAberto, setComposerAberto] = useState(false);
  const [amigos, setAmigos] = useState<AmigoResumo[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [perfil, setPerfil] = useState<UserProfile>({
    nome: auth.currentUser?.displayName || '',
    email: auth.currentUser?.email || '',
    telefone: '',
    cidade: '',
    dataCriacao: new Date().toLocaleDateString('pt-BR'),
    fotoUrl: auth.currentUser?.photoURL || null,
  });
  const [senhaForm, setSenhaForm] = useState({
    novaSenha: '',
    confirmarSenha: '',
  });
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const avatarUrl = useMemo(
    () => perfil.fotoUrl || usuario?.photoURL || avatarFallback(usuario?.uid),
    [perfil.fotoUrl, usuario?.photoURL, usuario?.uid],
  );

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  const buscarPerfil = useCallback(async () => {
    if (!usuario) return;

    try {
      const docRef = doc(db, 'usuarios', usuario.uid);
      const docSnap = await getDoc(docRef);
      const dados = docSnap.exists() ? docSnap.data() : {};
      const dataCriacao =
        typeof dados.dataCriacao === 'string'
          ? dados.dataCriacao
          : typeof dados.criadoEm?.toDate === 'function'
            ? dados.criadoEm.toDate().toLocaleDateString('pt-BR')
            : new Date().toLocaleDateString('pt-BR');

      setPerfil({
        nome: usuario.displayName || String(dados.nome || ''),
        email: usuario.email || String(dados.email || ''),
        telefone: String(dados.telefone || ''),
        cidade: String(dados.cidade || ''),
        dataCriacao,
        fotoUrl: usuario.photoURL || (typeof dados.fotoUrl === 'string' ? dados.fotoUrl : null),
      });
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar seu perfil.');
    }
  }, [usuario]);

  useEffect(() => {
    buscarPerfil();
  }, [buscarPerfil]);

  useEffect(() => {
    if (!usuario) {
      setAmigos([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'usuarios', usuario.uid, 'amigos'),
      (snapshot) => setAmigos(snapshot.docs.map((documento) => ({ uid: documento.id }))),
      (error) => {
        console.error('Erro ao carregar amigos do perfil:', error);
        setAmigos([]);
      },
    );

    return () => unsubscribe();
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      setPosts([]);
      return undefined;
    }

    const postsQuery = query(collection(db, 'posts'), orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        setPosts(
          snapshot.docs
            .map((documento) => {
              const dados = documento.data();
              return {
                id: documento.id,
                uid: String(dados.uid || ''),
                nome: String(dados.nome || 'Usuario'),
                fotoUsuario: typeof dados.fotoUsuario === 'string' ? dados.fotoUsuario : null,
                imagemUrl: String(dados.imagemUrl || ''),
                legenda: String(dados.legenda || ''),
                restaurante: String(dados.restaurante || ''),
                criadoEmTexto: formatarDataCurta(dados.criadoEm),
                storagePath: typeof dados.storagePath === 'string' ? dados.storagePath : null,
              };
            })
            .filter((post) => post.uid === usuario.uid),
        );
      },
      (error) => {
        console.error('Erro ao carregar posts do perfil:', error);
        setPosts([]);
      },
    );

    return () => unsubscribe();
  }, [usuario]);

  const salvarPerfil = async () => {
    if (!usuario) return;
    if (!perfil.nome.trim()) {
      Alert.alert('Erro', 'Nome nao pode estar vazio.');
      return;
    }
    if (perfil.telefone.trim() && !isValidPhone(perfil.telefone)) {
      Alert.alert('Telefone invalido', 'Digite um telefone com DDD, usando 10 ou 11 numeros.');
      return;
    }

    setLoading(true);
    try {
      await updateProfile(usuario, {
        displayName: perfil.nome.trim(),
        photoURL: perfil.fotoUrl || usuario.photoURL,
      });

      await setDoc(
        doc(db, 'usuarios', usuario.uid),
        {
          nome: perfil.nome.trim(),
          email: usuario.email || perfil.email,
          emailLower: (usuario.email || perfil.email).toLowerCase(),
          telefone: perfil.telefone.trim(),
          cidade: perfil.cidade.trim(),
          dataCriacao: perfil.dataCriacao,
          fotoUrl: perfil.fotoUrl || usuario.photoURL || null,
          atualizadoEm: new Date(),
        },
        { merge: true },
      );

      setConfigAberta(false);
      Alert.alert('Sucesso', 'Perfil atualizado.');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Falha ao salvar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const alterarFoto = async () => {
    if (!usuario) return;

    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissao necessaria', 'Libere acesso a galeria para trocar a foto.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (resultado.canceled || !resultado.assets[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const asset = resultado.assets[0];
      const contentType = asset.mimeType || 'image/jpeg';
      const extensao = extensaoDaImagem(contentType);
      const downloadUrl = await uploadImagemLocal(
        `usuarios/${usuario.uid}/perfil-${Date.now()}.${extensao}`,
        asset.uri,
        contentType,
      );

      await updateProfile(usuario, { photoURL: downloadUrl });
      await setDoc(
        doc(db, 'usuarios', usuario.uid),
        { fotoUrl: downloadUrl, atualizadoEm: new Date() },
        { merge: true },
      );

      setPerfil((current) => ({ ...current, fotoUrl: downloadUrl }));
    } catch (error) {
      console.error('Erro ao alterar foto:', error);
      Alert.alert('Erro', 'Nao foi possivel alterar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const alterarSenha = async () => {
    if (!usuario) return;
    if (!senhaForm.novaSenha || !senhaForm.confirmarSenha) {
      Alert.alert('Erro', 'Preencha os campos de senha.');
      return;
    }
    if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
      Alert.alert('Erro', 'As senhas nao conferem.');
      return;
    }
    if (senhaForm.novaSenha.length < 6) {
      Alert.alert('Erro', 'Senha deve ter no minimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(usuario, senhaForm.novaSenha);
      setSenhaForm({ novaSenha: '', confirmarSenha: '' });
      Alert.alert('Sucesso', 'Senha alterada.');
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', error.message || 'Falha ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  const encerrarSessao = () => {
    Alert.alert('Encerrar sessao?', 'Use isto apenas quando quiser desconectar sua conta.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Encerrar',
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          router.replace('/screens/login');
        },
      },
    ]);
  };

  if (!usuario) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <MaterialIcons name="person-off" size={34} color={BLUE_DARK} />
          <Text style={styles.emptyTitle}>Usuario nao autenticado</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/screens/login')}>
            <Text style={styles.primaryButtonText}>Ir para login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={22} color={INK} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Perfil</Text>
            <TouchableOpacity style={styles.iconButton} onPress={() => setConfigAberta(true)}>
              <MaterialIcons name="settings" size={22} color={INK} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={alterarFoto} disabled={uploadingPhoto}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              <View style={styles.cameraBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.name}>{perfil.nome || 'Usuario QueueGOO'}</Text>
              <Text style={styles.email} numberOfLines={1}>{perfil.email}</Text>
              <View style={styles.statsInline}>
                <StatBlock label="Posts" value={String(posts.length)} />
                <StatBlock label="Amigos" value={String(amigos.length)} />
                <StatBlock label="Cidade" value={perfil.cidade || '-'} />
              </View>
              <Text style={styles.memberText}>Membro desde {perfil.dataCriacao}</Text>
            </View>
          </View>

          <View style={styles.postsHeader}>
            <Text style={styles.sectionTitle}>Postagens</Text>
            <TouchableOpacity style={styles.addPostButton} onPress={() => setComposerAberto(true)}>
              <MaterialIcons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.postsList}>
            {posts.length ? (
              posts.map((post) => <PostCard key={post.id} post={post} currentUser={usuario} />)
            ) : (
              <View style={styles.emptyPosts}>
                <MaterialIcons name="photo-library" size={34} color={BLUE_DARK} />
                <Text style={styles.emptyTitle}>Nenhuma postagem ainda</Text>
                <Text style={styles.emptyText}>Use o + para publicar sua primeira dica.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <PostComposerModal
          visible={composerAberto}
          currentUser={usuario}
          authorName={perfil.nome || usuario.displayName || usuario.email || 'Usuario'}
          authorPhoto={perfil.fotoUrl || usuario.photoURL || null}
          onClose={() => setComposerAberto(false)}
        />
      </KeyboardAvoidingView>

      <Modal
        visible={configAberta}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConfigAberta(false)}
      >
        <SafeAreaView style={styles.settingsSafeArea}>
          <KeyboardAvoidingView
            style={styles.keyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View style={styles.settingsHeader}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setConfigAberta(false)}>
                <MaterialIcons name="close" size={22} color={INK} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Configuracoes</Text>
              <View style={styles.iconButtonPlaceholder} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsContent}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Editar informacoes</Text>
                <ProfileInput
                  label="Nome"
                  value={perfil.nome}
                  onChangeText={(nome) => setPerfil((current) => ({ ...current, nome }))}
                  placeholder="Seu nome"
                  editable={!loading}
                />
                <ProfileInput
                  label="Telefone"
                  value={perfil.telefone}
                  onChangeText={(telefone) =>
                    setPerfil((current) => ({ ...current, telefone: formatBrazilianPhone(telefone) }))
                  }
                  placeholder="(11) 99999-9999"
                  keyboardType="phone-pad"
                  editable={!loading}
                />
                <ProfileInput
                  label="Cidade"
                  value={perfil.cidade}
                  onChangeText={(cidade) => setPerfil((current) => ({ ...current, cidade }))}
                  placeholder="Sua cidade"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.disabledButton]}
                  onPress={salvarPerfil}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Salvar alteracoes</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Seguranca</Text>
                <ProfileInput
                  label="Nova senha"
                  value={senhaForm.novaSenha}
                  onChangeText={(novaSenha) => setSenhaForm((current) => ({ ...current, novaSenha }))}
                  placeholder="Digite uma nova senha"
                  secureTextEntry={!mostrarNovaSenha}
                  rightIcon={mostrarNovaSenha ? 'visibility-off' : 'visibility'}
                  onRightIconPress={() => setMostrarNovaSenha((value) => !value)}
                  editable={!loading}
                />
                <ProfileInput
                  label="Confirmar senha"
                  value={senhaForm.confirmarSenha}
                  onChangeText={(confirmarSenha) =>
                    setSenhaForm((current) => ({ ...current, confirmarSenha }))
                  }
                  placeholder="Confirme a nova senha"
                  secureTextEntry={!mostrarConfirmarSenha}
                  rightIcon={mostrarConfirmarSenha ? 'visibility-off' : 'visibility'}
                  onRightIconPress={() => setMostrarConfirmarSenha((value) => !value)}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.secondaryButton, loading && styles.disabledButton]}
                  onPress={alterarSenha}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>Alterar senha</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutButton} onPress={encerrarSessao}>
                  <MaterialIcons name="logout" size={18} color="#9F1239" />
                  <Text style={styles.logoutText}>Encerrar sessao</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
        <TextInput {...props} style={[styles.input, style]} placeholderTextColor="#7C8794" />
        {rightIcon && (
          <TouchableOpacity style={styles.inputIconButton} onPress={onRightIconPress}>
            <MaterialIcons name={rightIcon} size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

type StatBlockProps = {
  label: string;
  value: string;
};

function StatBlock({ label, value }: StatBlockProps) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  settingsSafeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  scrollContent: { paddingBottom: 34 },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsHeader: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: { width: 42, height: 42 },
  headerTitle: { fontFamily: 'Poppins_700Bold', color: INK, fontSize: 22 },
  profileHeader: {
    marginHorizontal: 18,
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#BBDEFB',
  },
  cameraBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, marginLeft: 14 },
  name: { fontSize: 21, color: INK, fontFamily: 'Poppins_700Bold' },
  email: { marginTop: 1, color: '#4B6475', fontSize: 13 },
  statsInline: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statBlock: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statValue: { color: BLUE_DARK, fontFamily: 'Poppins_700Bold', fontSize: 15, maxWidth: '100%' },
  statLabel: { color: '#4B6475', fontSize: 11, marginTop: 2, fontFamily: 'Urbanist_700Bold' },
  memberText: { color: '#667085', fontSize: 12, marginTop: 9 },
  postsHeader: {
    marginTop: 16,
    marginHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addPostButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsList: { marginTop: 12, marginHorizontal: 18 },
  section: {
    marginTop: 16,
    marginHorizontal: 18,
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  sectionTitle: { color: INK, fontSize: 17, fontFamily: 'Poppins_700Bold', marginBottom: 12 },
  inputGroup: { marginBottom: 12 },
  label: { color: '#344054', fontSize: 13, marginBottom: 6, fontFamily: 'Urbanist_700Bold' },
  inputShell: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    color: INK,
  },
  inputIconButton: {
    width: 44,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsContent: { paddingBottom: 34 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Urbanist_700Bold' },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  secondaryButtonText: { color: BLUE_DARK, fontSize: 15, fontFamily: 'Urbanist_700Bold' },
  logoutButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  logoutText: { color: '#9F1239', fontSize: 15, fontFamily: 'Urbanist_700Bold' },
  disabledButton: { opacity: 0.65 },
  emptyPosts: {
    minHeight: 190,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: { color: '#667085', textAlign: 'center', lineHeight: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  emptyTitle: { fontSize: 17, color: INK, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
});
