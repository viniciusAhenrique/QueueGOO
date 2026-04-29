import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth, updateProfile, updatePassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '@/firebaseconfig';

const auth = getAuth(app);
const db = getFirestore(app);

interface UserProfile {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  dataCriacao: string;
}

export default function Perfil() {
  const router = useRouter();
  const user = auth.currentUser;
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(false);
  const [perfil, setPerfil] = useState<UserProfile>({
    nome: user?.displayName || '',
    email: user?.email || '',
    telefone: '',
    cidade: '',
    dataCriacao: new Date().toLocaleDateString('pt-BR'),
  });

  const [senhaForm, setSenhaForm] = useState({
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: '',
  });

  const buscarPerfil = useCallback(async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dados = docSnap.data();
        setPerfil({
          nome: user.displayName || dados.nome || '',
          email: user.email || '',
          telefone: dados.telefone || '',
          cidade: dados.cidade || '',
          dataCriacao: dados.dataCriacao || new Date().toLocaleDateString('pt-BR'),
        });
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  }, [user]);

  useEffect(() => {
    buscarPerfil();
  }, [buscarPerfil]);

  const salvarPerfil = async () => {
    if (!user) return;
    if (!perfil.nome.trim()) {
      Alert.alert('Erro', 'Nome não pode estar vazio');
      return;
    }

    setLoading(true);
    try {
      // Atualizar nome no Firebase Auth
      if (perfil.nome !== user.displayName) {
        await updateProfile(user, {
          displayName: perfil.nome,
        });
      }

      // Salvar dados adicionais no Firestore
      await setDoc(doc(db, 'usuarios', user.uid), {
        nome: perfil.nome,
        telefone: perfil.telefone,
        cidade: perfil.cidade,
        dataCriacao: perfil.dataCriacao,
      }, { merge: true });

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
      setEditando(false);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Falha ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const alterarSenha = async () => {
    if (!senhaForm.novaSenha || !senhaForm.confirmarSenha) {
      Alert.alert('Erro', 'Preencha todos os campos de senha');
      return;
    }

    if (senhaForm.novaSenha !== senhaForm.confirmarSenha) {
      Alert.alert('Erro', 'As senhas não conferem');
      return;
    }

    if (senhaForm.novaSenha.length < 6) {
      Alert.alert('Erro', 'Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      if (user) {
        await updatePassword(user, senhaForm.novaSenha);
        Alert.alert('Sucesso', 'Senha alterada com sucesso!');
        setSenhaForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
      }
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', error.message || 'Falha ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Usuário não autenticado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#1e232c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Perfil</Text>
        <TouchableOpacity onPress={() => setEditando(!editando)}>
          <MaterialIcons name={editando ? "close" : "edit"} size={24} color="#1e232c" />
        </TouchableOpacity>
      </View>

      {/* Avatar e Informações Básicas */}
      <View style={styles.avatarSection}>
        <Image
          source={{ uri: `https://i.pravatar.cc/150?u=${user.uid}` }}
          style={styles.avatar}
        />
        <Text style={styles.userEmail}>{user.email}</Text>
        <Text style={styles.memberSince}>
          Membro desde {perfil.dataCriacao}
        </Text>
      </View>

      {/* Seção Editável */}
      {editando ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Editar Informações</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={perfil.nome}
              onChangeText={(text) => setPerfil({ ...perfil, nome: text })}
              placeholder="Seu nome"
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={perfil.telefone}
              onChangeText={(text) => setPerfil({ ...perfil, telefone: text })}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Cidade</Text>
            <TextInput
              style={styles.input}
              value={perfil.cidade}
              onChangeText={(text) => setPerfil({ ...perfil, cidade: text })}
              placeholder="Sua cidade"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={salvarPerfil}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Salvar Alterações</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Visualização */
        <View style={styles.viewSection}>
          <View style={styles.infoItem}>
            <MaterialIcons name="person" size={20} color="#4FC3F7" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Nome</Text>
              <Text style={styles.infoValue}>{perfil.nome || 'Não informado'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="email" size={20} color="#4FC3F7" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{perfil.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="phone" size={20} color="#4FC3F7" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Telefone</Text>
              <Text style={styles.infoValue}>{perfil.telefone || 'Não informado'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="location-city" size={20} color="#4FC3F7" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Cidade</Text>
              <Text style={styles.infoValue}>{perfil.cidade || 'Não informado'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Seção de Segurança */}
      <View style={styles.securitySection}>
        <Text style={styles.sectionTitle}>Segurança</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nova Senha</Text>
          <TextInput
            style={styles.input}
            value={senhaForm.novaSenha}
            onChangeText={(text) => setSenhaForm({ ...senhaForm, novaSenha: text })}
            placeholder="Digite uma nova senha"
            secureTextEntry
            editable={!loading}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Confirmar Senha</Text>
          <TextInput
            style={styles.input}
            value={senhaForm.confirmarSenha}
            onChangeText={(text) => setSenhaForm({ ...senhaForm, confirmarSenha: text })}
            placeholder="Confirme a nova senha"
            secureTextEntry
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
          onPress={alterarSenha}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#4FC3F7" />
          ) : (
            <Text style={styles.buttonTextSecondary}>Alterar Senha</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Espaço */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4FC3F7',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: '#1e232c',
  },
  avatarSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 12,
    color: '#999',
  },
  formSection: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  viewSection: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 8,
  },
  securitySection: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#1e232c',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Urbanist_600SemiBold',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Urbanist_600SemiBold',
    color: '#1e232c',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPrimary: {
    backgroundColor: '#4FC3F7',
  },
  buttonSecondary: {
    borderWidth: 2,
    borderColor: '#4FC3F7',
    backgroundColor: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Urbanist_600SemiBold',
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: '#4FC3F7',
    fontFamily: 'Urbanist_600SemiBold',
    fontSize: 16,
  },
  emptyText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    color: '#999',
  },
});
