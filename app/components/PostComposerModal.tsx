import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { User } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db } from '@/firebaseconfig';
import { avatarFallback } from '@/src/services/socialServices';
import { extensaoDaImagem, uploadImagemLocal } from '@/src/services/uploadServices';

type PostComposerModalProps = {
  visible: boolean;
  currentUser: User;
  authorName?: string;
  authorPhoto?: string | null;
  notifyUids?: string[];
  onClose: () => void;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function PostComposerModal({
  visible,
  currentUser,
  authorName,
  authorPhoto,
  notifyUids = [],
  onClose,
}: PostComposerModalProps) {
  const [postando, setPostando] = useState(false);
  const [postForm, setPostForm] = useState({
    restaurante: '',
    legenda: '',
    imagemUri: '',
    mimeType: 'image/jpeg',
  });

  const avatarUrl = authorPhoto || currentUser.photoURL || avatarFallback(currentUser.uid);
  const nome = authorName || currentUser.displayName || currentUser.email || 'Usuario';

  const limpar = () => {
    setPostForm({ restaurante: '', legenda: '', imagemUri: '', mimeType: 'image/jpeg' });
  };

  const fechar = () => {
    if (postando) return;
    limpar();
    onClose();
  };

  const escolherFotoPost = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissao necessaria', 'Libere acesso a galeria para publicar fotos.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.82,
    });

    const asset = resultado.assets?.[0];
    if (resultado.canceled || !asset?.uri) return;

    setPostForm((current) => ({
      ...current,
      imagemUri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
    }));
  };

  const publicarPost = async () => {
    if (!postForm.imagemUri) {
      Alert.alert('Foto obrigatoria', 'Escolha uma foto do prato ou restaurante.');
      return;
    }

    if (!postForm.restaurante.trim() || !postForm.legenda.trim()) {
      Alert.alert('Dados incompletos', 'Informe restaurante e legenda.');
      return;
    }

    setPostando(true);
    try {
      const extensao = extensaoDaImagem(postForm.mimeType);
      const storagePath = `usuarios/${currentUser.uid}/posts/post-${Date.now()}.${extensao}`;
      const imagemUrl = await uploadImagemLocal(storagePath, postForm.imagemUri, postForm.mimeType);

      await addDoc(collection(db, 'posts'), {
        uid: currentUser.uid,
        nome,
        fotoUsuario: authorPhoto || currentUser.photoURL || null,
        restaurante: postForm.restaurante.trim(),
        legenda: postForm.legenda.trim(),
        imagemUrl,
        storagePath,
        criadoEm: serverTimestamp(),
      });

      await Promise.all(
        notifyUids.map((uid) =>
          addDoc(collection(db, 'usuarios', uid, 'notificacoes'), {
            tipo: 'post',
            titulo: 'Nova dica no feed',
            mensagem: `${nome} publicou uma dica.`,
            remetenteUid: currentUser.uid,
            lida: false,
            criadoEm: serverTimestamp(),
          }),
        ),
      );

      limpar();
      onClose();
    } catch (error) {
      console.error('Erro ao publicar post:', error);
      Alert.alert('Erro', 'Nao foi possivel publicar. Confira as regras do Firebase.');
    } finally {
      setPostando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={fechar}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.closeButton} onPress={fechar}>
            <MaterialIcons name="close" size={22} color={INK} />
          </TouchableOpacity>

          <Text style={styles.title}>Nova postagem</Text>

          <TouchableOpacity style={styles.authorRow}>
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            <Text style={styles.authorName}>{nome}</Text>
          </TouchableOpacity>

          {postForm.imagemUri ? (
            <Image source={{ uri: postForm.imagemUri }} style={styles.previewImage} />
          ) : (
            <TouchableOpacity style={styles.photoPlaceholder} onPress={escolherFotoPost}>
              <MaterialIcons name="add-photo-alternate" size={28} color={BLUE_DARK} />
              <Text style={styles.photoPlaceholderText}>Escolher foto</Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.input}
            value={postForm.restaurante}
            onChangeText={(restaurante) => setPostForm((current) => ({ ...current, restaurante }))}
            placeholder="Restaurante ou mercado"
            placeholderTextColor="#667085"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={postForm.legenda}
            onChangeText={(legenda) => setPostForm((current) => ({ ...current, legenda }))}
            placeholder="O que voce recomenda?"
            placeholderTextColor="#667085"
            multiline
          />

          <TouchableOpacity style={styles.secondaryButton} onPress={escolherFotoPost}>
            <MaterialIcons name="photo-library" size={18} color={BLUE_DARK} />
            <Text style={styles.secondaryButtonText}>Trocar foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishButton, postando && styles.disabledButton]}
            onPress={publicarPost}
            disabled={postando}
          >
            {postando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.publishButtonText}>Publicar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: INK, fontSize: 26, fontFamily: 'Poppins_700Bold', marginBottom: 14 },
  authorRow: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  authorName: { color: INK, fontFamily: 'Urbanist_700Bold', fontSize: 15 },
  photoPlaceholder: {
    minHeight: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#90CAF9',
    backgroundColor: '#F4FAFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  photoPlaceholderText: { color: BLUE_DARK, fontFamily: 'Urbanist_700Bold' },
  previewImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: 8, marginBottom: 12 },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: INK,
    marginBottom: 10,
  },
  textArea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BLUE_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 10,
  },
  secondaryButtonText: { color: BLUE_DARK, fontFamily: 'Urbanist_700Bold' },
  publishButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold', fontSize: 16 },
  disabledButton: { opacity: 0.65 },
});
