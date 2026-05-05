import { MaterialIcons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { db, storage } from '@/firebaseconfig';
import { avatarFallback, formatarDataCurta } from '@/src/services/socialServices';

export type PostItem = {
  id: string;
  uid: string;
  nome: string;
  fotoUsuario: string | null;
  imagemUrl: string;
  legenda: string;
  restaurante: string;
  criadoEmTexto: string;
  storagePath?: string | null;
};

type Comentario = {
  id: string;
  uid: string;
  nome: string;
  fotoUsuario: string | null;
  texto: string;
  criadoEmTexto: string;
};

type PostCardProps = {
  post: PostItem;
  currentUser: User;
  onOpenAuthor?: (uid: string) => void;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

export default function PostCard({ post, currentUser, onOpenAuthor }: PostCardProps) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [comentario, setComentario] = useState('');
  const [comentariosAbertos, setComentariosAbertos] = useState(false);
  const [editAberto, setEditAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editForm, setEditForm] = useState({
    restaurante: post.restaurante,
    legenda: post.legenda,
  });

  const podeGerenciar = currentUser.uid === post.uid;

  useEffect(() => {
    const comentariosQuery = query(
      collection(db, 'posts', post.id, 'comentarios'),
      orderBy('criadoEm', 'asc'),
    );

    const unsubscribe = onSnapshot(
      comentariosQuery,
      (snapshot) => {
        setComentarios(
          snapshot.docs.map((documento) => {
            const dados = documento.data();
            return {
              id: documento.id,
              uid: String(dados.uid || ''),
              nome: String(dados.nome || 'Usuario'),
              fotoUsuario: typeof dados.fotoUsuario === 'string' ? dados.fotoUsuario : null,
              texto: String(dados.texto || ''),
              criadoEmTexto: formatarDataCurta(dados.criadoEm),
            };
          }),
        );
      },
      (error) => {
        console.error('Erro ao carregar comentarios:', error);
        setComentarios([]);
      },
    );

    return () => unsubscribe();
  }, [post.id]);

  useEffect(() => {
    setEditForm({ restaurante: post.restaurante, legenda: post.legenda });
  }, [post.legenda, post.restaurante]);

  const comentar = async () => {
    const texto = comentario.trim();
    if (!texto) return;

    setComentario('');
    try {
      await addDoc(collection(db, 'posts', post.id, 'comentarios'), {
        uid: currentUser.uid,
        nome: currentUser.displayName || currentUser.email || 'Usuario',
        fotoUsuario: currentUser.photoURL || null,
        texto,
        criadoEm: serverTimestamp(),
      });

      if (post.uid !== currentUser.uid) {
        await addDoc(collection(db, 'usuarios', post.uid, 'notificacoes'), {
          tipo: 'comentario_post',
          titulo: 'Novo comentario',
          mensagem: `${currentUser.displayName || currentUser.email || 'Alguem'} comentou na sua postagem.`,
          postId: post.id,
          remetenteUid: currentUser.uid,
          lida: false,
          criadoEm: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Erro ao comentar post:', error);
      Alert.alert('Erro', 'Nao foi possivel comentar.');
      setComentario(texto);
    }
  };

  const salvarEdicao = async () => {
    if (!podeGerenciar) return;
    if (!editForm.restaurante.trim() || !editForm.legenda.trim()) {
      Alert.alert('Dados incompletos', 'Informe restaurante e legenda.');
      return;
    }

    setSalvando(true);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        restaurante: editForm.restaurante.trim(),
        legenda: editForm.legenda.trim(),
        atualizadoEm: serverTimestamp(),
      });
      setEditAberto(false);
    } catch (error) {
      console.error('Erro ao editar post:', error);
      Alert.alert('Erro', 'Nao foi possivel editar a postagem.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirPost = () => {
    if (!podeGerenciar) return;

    Alert.alert('Excluir postagem?', 'A postagem deixara de aparecer para voce e seus amigos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            if (post.storagePath) {
              await deleteObject(ref(storage, post.storagePath)).catch((error) => {
                console.warn('Imagem do post nao foi removida do Storage:', error);
              });
            }
            await deleteDoc(doc(db, 'posts', post.id));
          } catch (error) {
            console.error('Erro ao excluir post:', error);
            Alert.alert('Erro', 'Nao foi possivel excluir a postagem.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.post}>
      <TouchableOpacity style={styles.postHeader} onPress={() => onOpenAuthor?.(post.uid)}>
        <Image source={{ uri: post.fotoUsuario || avatarFallback(post.uid) }} style={styles.postAvatar} />
        <View style={styles.postUser}>
          <Text style={styles.postName}>{post.nome}</Text>
          <Text style={styles.postPlace}>{post.restaurante}</Text>
        </View>
        <Text style={styles.postDate}>{post.criadoEmTexto}</Text>
      </TouchableOpacity>

      <Image source={{ uri: post.imagemUrl }} style={styles.postImage} />

      <View style={styles.postBody}>
        <Text style={styles.postCaption}>
          <Text style={styles.postName}>{post.nome} </Text>
          {post.legenda}
        </Text>

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setComentariosAbertos((current) => !current)}
          >
            <MaterialIcons name="chat-bubble-outline" size={19} color={BLUE_DARK} />
            <Text style={styles.actionText}>
              {comentarios.length ? `${comentarios.length} comentarios` : 'Comentar'}
            </Text>
          </TouchableOpacity>

          {podeGerenciar && (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.iconAction} onPress={() => setEditAberto(true)}>
                <MaterialIcons name="edit" size={18} color={BLUE_DARK} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconActionDanger} onPress={excluirPost}>
                <MaterialIcons name="delete-outline" size={18} color="#9F1239" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {comentariosAbertos && (
          <View style={styles.commentsBox}>
            {comentarios.map((item) => (
              <View key={item.id} style={styles.commentRow}>
                <Image
                  source={{ uri: item.fotoUsuario || avatarFallback(item.uid) }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentTextBox}>
                  <Text style={styles.commentText}>
                    <Text style={styles.commentName}>{item.nome} </Text>
                    {item.texto}
                  </Text>
                  <Text style={styles.commentDate}>{item.criadoEmTexto}</Text>
                </View>
              </View>
            ))}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={comentario}
                onChangeText={setComentario}
                placeholder="Comentar..."
                placeholderTextColor="#667085"
              />
              <TouchableOpacity style={styles.commentButton} onPress={comentar}>
                <MaterialIcons name="send" size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal visible={editAberto} animationType="slide" onRequestClose={() => setEditAberto(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalIcon} onPress={() => setEditAberto(false)}>
                <MaterialIcons name="close" size={22} color={INK} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Editar postagem</Text>
              <View style={styles.modalIconPlaceholder} />
            </View>

            <Image source={{ uri: post.imagemUrl }} style={styles.modalImage} />
            <TextInput
              style={styles.modalInput}
              value={editForm.restaurante}
              onChangeText={(restaurante) => setEditForm((current) => ({ ...current, restaurante }))}
              placeholder="Restaurante ou mercado"
              placeholderTextColor="#667085"
            />
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={editForm.legenda}
              onChangeText={(legenda) => setEditForm((current) => ({ ...current, legenda }))}
              placeholder="Legenda"
              placeholderTextColor="#667085"
              multiline
            />
            <TouchableOpacity
              style={[styles.saveButton, salvando && styles.disabledButton]}
              onPress={salvarEdicao}
              disabled={salvando}
            >
              {salvando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar alteracoes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    overflow: 'hidden',
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  postAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  postUser: { flex: 1 },
  postName: { color: INK, fontFamily: 'Urbanist_700Bold', fontSize: 14 },
  postPlace: { color: '#667085', fontSize: 12, marginTop: 1 },
  postDate: { color: '#94A3B8', fontSize: 11 },
  postImage: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#BBDEFB' },
  postBody: { padding: 12 },
  postCaption: { color: '#344054', lineHeight: 20 },
  postActions: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: BLUE_DARK, fontFamily: 'Urbanist_700Bold', fontSize: 13 },
  ownerActions: { flexDirection: 'row', gap: 8 },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionDanger: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsBox: { borderTopWidth: 1, borderTopColor: '#E3F2FD', paddingTop: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  commentTextBox: { flex: 1 },
  commentText: { color: '#344054', lineHeight: 19 },
  commentName: { color: INK, fontFamily: 'Urbanist_700Bold' },
  commentDate: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  commentInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 10,
    color: INK,
  },
  commentButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSafeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  modalContent: { padding: 18, paddingBottom: 34 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconPlaceholder: { width: 42, height: 42 },
  modalTitle: { color: INK, fontSize: 21, fontFamily: 'Poppins_700Bold' },
  modalImage: { width: '100%', aspectRatio: 4 / 5, borderRadius: 8, marginBottom: 12 },
  modalInput: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: INK,
    marginBottom: 10,
  },
  modalTextArea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveButtonText: { color: '#FFFFFF', fontFamily: 'Urbanist_700Bold', fontSize: 15 },
  disabledButton: { opacity: 0.65 },
});
