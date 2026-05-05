import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Linking from 'expo-linking';

interface ModalReservaProps {
  visible: boolean;
  onClose: () => void;
  onCriarEvento?: (dados: { pessoas: string; data: Date }) => void;
  placeId: string;
  nomeRestaurante: string;
  cidade: string;
  capacidadeMaxima: number;
  telefoneRestaurante: string;
}

const ModalReserva: React.FC<ModalReservaProps> = ({
  visible,
  onClose,
  onCriarEvento,
  placeId,
  nomeRestaurante,
  cidade,
  capacidadeMaxima,
  telefoneRestaurante,
}) => {
  const [carregando, setCarregando] = useState(false);
  const [numPessoas, setNumPessoas] = useState('');
  const [dataReserva, setDataReserva] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const buscarDadosUsuario = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const docUser = await getDoc(doc(db, 'usuarios', user.uid));
      if (!docUser.exists()) return null;

      return {
        uid: user.uid,
        nome: docUser.data().nome,
        telefone: docUser.data().telefone,
      };
    } catch (error) {
      console.error('Erro ao buscar dados do usuario:', error);
      return null;
    }
  };

  const registrarReserva = async () => {
    setCarregando(true);

    const usuario = await buscarDadosUsuario();
    if (!usuario) {
      setCarregando(false);
      Alert.alert('Login necessario', 'Entre na sua conta para fazer reservas.');
      return;
    }

    if (!numPessoas.trim() || isNaN(Number(numPessoas))) {
      setCarregando(false);
      Alert.alert('Dados incompletos', 'Informe corretamente o numero de pessoas.');
      return;
    }

    if (!telefoneRestaurante) {
      setCarregando(false);
      Alert.alert('Telefone indisponivel', 'Este restaurante nao informou telefone para reserva.');
      return;
    }

    const dataTexto = formatarData(dataReserva);
    const horaTexto = formatarHora(dataReserva);

    const mensagem = `Ola, gostaria de fazer uma reserva no restaurante *${nomeRestaurante}* para *${numPessoas} pessoas* no dia *${dataTexto}* as *${horaTexto}*. Meu nome e *${usuario.nome}*.`;

    const numeroWhatsApp = telefoneRestaurante.replace(/\D/g, '');
    const url = `https://wa.me/55${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;

    try {
      await Linking.openURL(url);

      await addDoc(collection(db, 'reservas'), {
        userId: usuario.uid,
        placeId,
        restauranteNome: nomeRestaurante,
        cidade,
        capacidadeMaxima,
        telefoneRestaurante,
        numPessoas: Number(numPessoas),
        data: dataTexto,
        hora: horaTexto,
        status: 'solicitada_whatsapp',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });

      onClose();
      setNumPessoas('');
      setDataReserva(new Date());
    } catch (error) {
      console.error('Erro ao registrar reserva:', error);
      Alert.alert('Erro', 'Nao foi possivel registrar a reserva. Confira as permissoes do Firestore.');
    } finally {
      setCarregando(false);
    }
  };

  const iniciarEvento = () => {
    if (!numPessoas.trim() || isNaN(Number(numPessoas))) {
      Alert.alert('Dados incompletos', 'Informe o numero de pessoas antes de criar o evento.');
      return;
    }

    onCriarEvento?.({ pessoas: numPessoas, data: dataReserva });
  };

  const formatarData = (date: Date) => {
    return date.toLocaleDateString();
  };

  const formatarHora = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>R</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Reserva</Text>
              <Text style={styles.subtitle} numberOfLines={2}>{nomeRestaurante}</Text>
            </View>
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryText}>Cidade: {cidade || 'Nao informada'}</Text>
            <Text style={styles.summaryText}>
              Capacidade estimada: {capacidadeMaxima || 100} pessoas
            </Text>
          </View>

          <Text style={styles.label}>Quantidade de pessoas</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 4"
            keyboardType="numeric"
            value={numPessoas}
            onChangeText={setNumPessoas}
            placeholderTextColor="#667085"
          />

          <Text style={styles.label}>Data</Text>
          <TouchableOpacity
            style={styles.pickerInput}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.pickerText}>
              {formatarData(dataReserva)}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Horario</Text>
          <TouchableOpacity
            style={styles.pickerInput}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.pickerText}>
              {formatarHora(dataReserva)}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={dataReserva}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  const novaData = new Date(dataReserva);
                  novaData.setFullYear(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate()
                  );
                  setDataReserva(novaData);
                }
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={dataReserva}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) {
                  const novaHora = new Date(dataReserva);
                  novaHora.setHours(
                    selectedTime.getHours(),
                    selectedTime.getMinutes()
                  );
                  setDataReserva(novaHora);
                }
              }}
            />
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={registrarReserva}
            disabled={carregando}
          >
            <Text style={styles.buttonText}>
              {carregando ? 'Abrindo WhatsApp...' : 'Reservar pelo WhatsApp'}
            </Text>
          </TouchableOpacity>

          {onCriarEvento && (
            <TouchableOpacity
              style={styles.eventButton}
              onPress={iniciarEvento}
              disabled={carregando}
            >
              <Text style={styles.eventButtonText}>Criar evento com estes dados</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    width: '88%',
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerIconText: {
    color: '#0D47A1',
    fontSize: 20,
    fontWeight: '800',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e232c',
  },
  subtitle: {
    color: '#4B6475',
    fontSize: 14,
    marginTop: 2,
  },
  summary: {
    borderRadius: 10,
    backgroundColor: '#F4FAFF',
    borderWidth: 1,
    borderColor: '#B3E5FC',
    padding: 10,
    marginBottom: 14,
  },
  summaryText: {
    color: '#344054',
    fontSize: 13,
    marginBottom: 2,
  },
  label: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#B3E5FC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 12,
    justifyContent: 'center',
    color: '#1e232c',
    backgroundColor: '#FFFFFF',
  },
  pickerInput: {
    borderWidth: 1,
    borderColor: '#B3E5FC',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  pickerText: {
    fontSize: 16,
    color: '#1e232c',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#0D47A1',
    minHeight: 48,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventButton: {
    borderWidth: 1,
    borderColor: '#0D47A1',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: '#E3F2FD',
  },
  eventButtonText: {
    color: '#0D47A1',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
  },
});

export default ModalReserva;
