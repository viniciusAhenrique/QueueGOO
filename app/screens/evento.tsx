import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { auth, db } from '@/firebaseconfig';
import { criarNotificacaoUsuario } from '@/src/services/pushNotificationService';

type Evento = {
  id: string;
  titulo: string;
  local: string;
  data: string;
  hora: string;
  descricao: string;
  participantes: string[];
  convidadoUids: string[];
  convidados: string[];
  criadoPor: string;
  criadorNome: string;
  status: string;
  respostas: Record<string, string>;
  ocultoPara: string[];
};

type Mensagem = {
  id: string;
  uid: string;
  nome: string;
  texto: string;
};

const BLUE_DARK = '#0D47A1';
const INK = '#1e232c';

function dataDeEvento(data?: string, hora?: string) {
  const value = data ? new Date(`${data}T${hora || '20:00'}:00`) : new Date();
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

function formatarData(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarHora(data: Date) {
  return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EventoDetalhes() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [editAberto, setEditAberto] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editForm, setEditForm] = useState({
    titulo: '',
    descricao: '',
    dataHora: new Date(),
  });

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!eventId || !user?.uid) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, 'eventos_sociais', eventId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setEvento(null);
          return;
        }

        const dados = snapshot.data();
        setEvento({
          id: snapshot.id,
          titulo: String(dados.titulo || ''),
          local: String(dados.local || ''),
          data: String(dados.data || ''),
          hora: String(dados.hora || ''),
          descricao: String(dados.descricao || ''),
          participantes: Array.isArray(dados.participantes) ? dados.participantes : [],
          convidadoUids: Array.isArray(dados.convidadoUids) ? dados.convidadoUids : [],
          convidados: Array.isArray(dados.convidados) ? dados.convidados : [],
          criadoPor: String(dados.criadoPor || ''),
          criadorNome: String(dados.criadorNome || 'Usuario'),
          status: String(dados.status || 'ativo'),
          respostas:
            dados.respostas && typeof dados.respostas === 'object'
              ? (dados.respostas as Record<string, string>)
              : {},
          ocultoPara: Array.isArray(dados.ocultoPara) ? dados.ocultoPara : [],
        });
      },
      (error) => {
        console.error('Erro ao carregar evento:', error);
        Alert.alert('Erro', 'Nao foi possivel carregar o evento.');
      },
    );

    return () => unsubscribe();
  }, [eventId, user?.uid]);

  useEffect(() => {
    if (!eventId || !user?.uid) return undefined;

    const mensagensRef = query(
      collection(db, 'eventos_sociais', eventId, 'mensagens'),
      orderBy('criadoEm', 'asc'),
    );

    const unsubscribe = onSnapshot(
      mensagensRef,
      (snapshot) => {
        setMensagens(
          snapshot.docs.map((documento) => {
            const dados = documento.data();
            return {
              id: documento.id,
              uid: String(dados.uid || ''),
              nome: String(dados.nome || 'Usuario'),
              texto: String(dados.texto || ''),
            };
          }),
        );
      },
      (error) => {
        console.error('Erro ao carregar conversa:', error);
        setMensagens([]);
      },
    );

    return () => unsubscribe();
  }, [eventId, user?.uid]);

  const podeGerenciar = Boolean(user && evento && user.uid === evento.criadoPor);
  const respostaAtual = user && evento ? evento.respostas[user.uid] : undefined;
  const estaCancelado = evento?.status === 'cancelado';

  const participantesTexto = useMemo(() => {
    if (!evento) return '0 confirmados';
    return `${evento.participantes.length} confirmados`;
  }, [evento]);

  const responder = async (resposta: 'aceito' | 'recusado') => {
    if (!user || !evento) return;

    try {
      await updateDoc(doc(db, 'eventos_sociais', evento.id), {
        [`respostas.${user.uid}`]: resposta,
        participantes: resposta === 'aceito' ? arrayUnion(user.uid) : arrayRemove(user.uid),
        atualizadoEm: serverTimestamp(),
      });

      if (evento.criadoPor !== user.uid) {
        await criarNotificacaoUsuario(evento.criadoPor, {
          tipo: 'evento',
          titulo: resposta === 'aceito' ? 'Convite aceito' : 'Convite recusado',
          mensagem: `${user.displayName || user.email || 'Alguem'} ${
            resposta === 'aceito' ? 'aceitou' : 'recusou'
          } o convite para ${evento.titulo}.`,
          eventoId: evento.id,
          remetenteUid: user.uid,
        });
      }
    } catch (error) {
      console.error('Erro ao responder convite:', error);
      Alert.alert('Erro', 'Nao foi possivel responder ao convite.');
    }
  };

  const enviarMensagem = async () => {
    if (!user || !evento || !mensagem.trim()) return;

    const texto = mensagem.trim();
    try {
      await addDoc(collection(db, 'eventos_sociais', evento.id, 'mensagens'), {
        uid: user.uid,
        nome: user.displayName || user.email || 'Usuario',
        texto,
        criadoEm: serverTimestamp(),
      });

      const destinoUids = Array.from(
        new Set([...evento.participantes, ...evento.convidadoUids, evento.criadoPor]),
      ).filter((uid) => uid && uid !== user.uid);

      await Promise.all(
        destinoUids.map((uid) =>
          criarNotificacaoUsuario(uid, {
            tipo: 'mensagem_evento',
            titulo: 'Nova mensagem no evento',
            mensagem: `${user.displayName || user.email || 'Alguem'} comentou em ${evento.titulo}.`,
            eventoId: evento.id,
          }),
        ),
      );

      setMensagem('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      Alert.alert('Permissao pendente', 'Publique as regras do Firestore para liberar a conversa do evento.');
    }
  };

  const abrirEdicao = () => {
    if (!evento) return;
    setEditForm({
      titulo: evento.titulo,
      descricao: evento.descricao,
      dataHora: dataDeEvento(evento.data, evento.hora),
    });
    setEditAberto(true);
  };

  const salvarEdicao = async () => {
    if (!evento) return;

    try {
      await updateDoc(doc(db, 'eventos_sociais', evento.id), {
        titulo: editForm.titulo.trim(),
        descricao: editForm.descricao.trim(),
        data: formatarData(editForm.dataHora),
        hora: formatarHora(editForm.dataHora),
        atualizadoEm: serverTimestamp(),
      });
      setEditAberto(false);
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      Alert.alert('Erro', 'Nao foi possivel salvar as alteracoes.');
    }
  };

  const cancelarEvento = () => {
    if (!evento) return;

    Alert.alert('Cancelar evento?', 'Os participantes ainda poderao ver o evento como cancelado.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar evento',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'eventos_sociais', evento.id), {
              status: 'cancelado',
              atualizadoEm: serverTimestamp(),
            });

            const destinoUids = Array.from(
              new Set([...evento.participantes, ...evento.convidadoUids]),
            ).filter((uid) => uid && uid !== user?.uid);

            await Promise.all(
              destinoUids.map((uid) =>
                criarNotificacaoUsuario(uid, {
                  tipo: 'evento_cancelado',
                  titulo: 'Evento cancelado',
                  mensagem: `${evento.titulo} foi cancelado.`,
                  eventoId: evento.id,
                }),
              ),
            );
          } catch (error) {
            console.error('Erro ao cancelar evento:', error);
            Alert.alert('Erro', 'Nao foi possivel cancelar o evento.');
          }
        },
      },
    ]);
  };

  const excluirEvento = () => {
    if (!evento) return;

    Alert.alert('Excluir evento?', 'Esta acao remove o evento da lista para todos.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'eventos_sociais', evento.id));
            router.replace('/screens/social');
          } catch (error) {
            console.error('Erro ao excluir evento:', error);
            Alert.alert('Erro', 'Nao foi possivel excluir o evento.');
          }
        },
      },
    ]);
  };

  const removerDaMinhaLista = () => {
    if (!evento || !user) return;

    Alert.alert('Remover evento?', 'Ele sai apenas da sua lista. O evento continua para as outras pessoas.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'eventos_sociais', evento.id), {
              ocultoPara: arrayUnion(user.uid),
              participantes: arrayRemove(user.uid),
              [`respostas.${user.uid}`]: 'removido',
              atualizadoEm: serverTimestamp(),
            });
            router.replace('/screens/social');
          } catch (error) {
            console.error('Erro ao remover evento:', error);
            Alert.alert('Erro', 'Nao foi possivel remover este evento da sua lista.');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Entre para ver o evento.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!evento) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={BLUE_DARK} style={{ marginTop: 60 }} />
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={22} color={INK} />
            </TouchableOpacity>
            {estaCancelado && (
              <View style={styles.cancelBadge}>
                <Text style={styles.cancelBadgeText}>Cancelado</Text>
              </View>
            )}
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>{evento.titulo}</Text>
            <View style={styles.metaRow}>
              <MaterialIcons name="place" size={18} color={BLUE_DARK} />
              <Text style={styles.metaText}>{evento.local}</Text>
            </View>
            <View style={styles.metaRow}>
              <MaterialIcons name="event" size={18} color={BLUE_DARK} />
              <Text style={styles.metaText}>
                {evento.data} {evento.hora}
              </Text>
            </View>
            <Text style={styles.description}>{evento.descricao || 'Sem descricao.'}</Text>
            <Text style={styles.participants}>{participantesTexto}</Text>
          </View>

          {!podeGerenciar && !respostaAtual && !estaCancelado && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.acceptButton} onPress={() => responder('aceito')}>
                <Text style={styles.acceptButtonText}>Aceitar convite</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declineButton} onPress={() => responder('recusado')}>
                <Text style={styles.declineButtonText}>Recusar</Text>
              </TouchableOpacity>
            </View>
          )}

          {podeGerenciar && (
            <View style={styles.managerPanel}>
              <TouchableOpacity style={styles.managerButton} onPress={abrirEdicao}>
                <MaterialIcons name="edit-calendar" size={18} color={BLUE_DARK} />
                <Text style={styles.managerButtonText}>Editar ou remarcar</Text>
              </TouchableOpacity>
              {!estaCancelado && (
                <TouchableOpacity style={styles.dangerButton} onPress={cancelarEvento}>
                  <MaterialIcons name="event-busy" size={18} color="#9F1239" />
                  <Text style={styles.dangerButtonText}>Cancelar evento</Text>
                </TouchableOpacity>
              )}
              {estaCancelado && (
                <TouchableOpacity style={styles.dangerButton} onPress={excluirEvento}>
                  <MaterialIcons name="delete" size={18} color="#9F1239" />
                  <Text style={styles.dangerButtonText}>Excluir evento cancelado</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.removeSelfButton} onPress={removerDaMinhaLista}>
            <MaterialIcons name="visibility-off" size={18} color="#4B5563" />
            <Text style={styles.removeSelfButtonText}>Remover da minha lista</Text>
          </TouchableOpacity>

          <View style={styles.chatPanel}>
            <Text style={styles.sectionTitle}>Conversa</Text>
            {mensagens.length ? (
              mensagens.map((item) => {
                const minha = item.uid === user.uid;
                return (
                  <View key={item.id} style={[styles.message, minha && styles.myMessage]}>
                    <Text style={styles.messageName}>{item.nome}</Text>
                    <Text style={styles.messageText}>{item.texto}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Nenhuma mensagem ainda.</Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Mensagem para o grupo"
            placeholderTextColor="#667085"
          />
          <TouchableOpacity style={styles.sendButton} onPress={enviarMensagem}>
            <MaterialIcons name="send" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={editAberto} animationType="slide" onRequestClose={() => setEditAberto(false)}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.editContent}>
            <View style={styles.topRow}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setEditAberto(false)}>
                <MaterialIcons name="close" size={22} color={INK} />
              </TouchableOpacity>
              <Text style={styles.editTitle}>Editar evento</Text>
              <View style={styles.iconPlaceholder} />
            </View>

            <TextInput
              style={styles.input}
              value={editForm.titulo}
              onChangeText={(titulo) => setEditForm((current) => ({ ...current, titulo }))}
              placeholder="Titulo"
              placeholderTextColor="#667085"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editForm.descricao}
              onChangeText={(descricao) => setEditForm((current) => ({ ...current, descricao }))}
              placeholder="Descricao"
              placeholderTextColor="#667085"
              multiline
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.pickerButtonText}>{formatarData(editForm.dataHora)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.pickerButtonText}>{formatarHora(editForm.dataHora)}</Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={editForm.dataHora}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, selectedDate) => {
                  setShowDatePicker(false);
                  if (!selectedDate) return;
                  const next = new Date(editForm.dataHora);
                  next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                  setEditForm((current) => ({ ...current, dataHora: next }));
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={editForm.dataHora}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, selectedTime) => {
                  setShowTimePicker(false);
                  if (!selectedTime) return;
                  const next = new Date(editForm.dataHora);
                  next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                  setEditForm((current) => ({ ...current, dataHora: next }));
                }}
              />
            )}

            <TouchableOpacity style={styles.saveButton} onPress={salvarEdicao}>
              <Text style={styles.saveButtonText}>Salvar alteracoes</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E3F2FD' },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 110 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  iconPlaceholder: { width: 42, height: 42 },
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 16,
  },
  title: { color: INK, fontSize: 25, fontWeight: '800', lineHeight: 31 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  metaText: { color: '#344054', flex: 1, fontWeight: '700' },
  description: { marginTop: 14, color: '#344054', lineHeight: 20 },
  participants: { marginTop: 12, color: BLUE_DARK, fontWeight: '800' },
  cancelBadge: { backgroundColor: '#FFF1F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cancelBadgeText: { color: '#9F1239', fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  acceptButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: { color: '#FFFFFF', fontWeight: '800' },
  declineButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FDA4AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: { color: '#9F1239', fontWeight: '800' },
  managerPanel: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 12,
    gap: 10,
  },
  managerButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  managerButtonText: { color: BLUE_DARK, fontWeight: '800' },
  dangerButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerButtonText: { color: '#9F1239', fontWeight: '800' },
  removeSelfButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  removeSelfButtonText: { color: '#4B5563', fontWeight: '800' },
  chatPanel: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 14,
  },
  sectionTitle: { color: INK, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  message: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    borderRadius: 8,
    backgroundColor: '#F8FCFF',
    borderWidth: 1,
    borderColor: '#E3F2FD',
    padding: 10,
    marginBottom: 8,
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#E3F2FD' },
  messageName: { color: BLUE_DARK, fontWeight: '800', fontSize: 12, marginBottom: 3 },
  messageText: { color: INK, lineHeight: 19 },
  emptyText: { color: '#667085' },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 74,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#B3E5FC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
    paddingHorizontal: 12,
    color: INK,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editContent: { padding: 18, paddingBottom: 36 },
  editTitle: { color: INK, fontSize: 21, fontWeight: '800' },
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
  pickerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtonText: { color: INK, fontWeight: '800' },
  saveButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: BLUE_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: INK, fontSize: 18, fontWeight: '800', textAlign: 'center' },
});
