import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Link, useRouter } from 'expo-router';
import ModalRestaurante from './components/modalRestaurante';

export default function Mapa() {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const locationSubscription = useRef(null);
  const user = auth.currentUser;
  const nomeUsuario = user?.displayName || user?.email || 'Usuário';

  const toggleMenu = () => {
    Animated.timing(slideAnim, {
      toValue: menuOpen ? -menuWidth : 0,
      duration: 250,
      useNativeDriver: false,
    }).start(() => setMenuOpen(!menuOpen));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const centralizarLocal = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const irParaBuscar = () => router.push('/BuscarLayer');
  const irParaFavoritos = () => router.push('/favoritos');

  const getPinColor = (lot) => {
    if (lot > 80) return 'red';
    if (lot >= 40) return 'gold';
    return 'green';
  };

  const handleMapDrag = () => {
    setLugarSelecionado(null);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLugares(prev => prev.map(l => ({
        ...l,
        lotacao: Math.floor(Math.random() * 100) + 1,
      })));
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      buscarGooglePlaces(location.coords.latitude, location.coords.longitude);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 1000,
        },
        (newLocation) => {
          setUserLocation(newLocation.coords);
        }
      );
    })();

    return () => locationSubscription.current?.remove();
  }, []);

  const buscarGooglePlaces = async (latitude, longitude) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=3000&type=restaurant&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status !== 'OK') return;

      setLugares(data.results.map(item => ({
        id: item.place_id,
        nome: item.name,
        tipo: item.types?.[0] || 'Restaurante',
        latitude: item.geometry.location.lat,
        longitude: item.geometry.location.lng,
        foto: item.photos?.[0]?.photo_reference || null,
        lotacao: Math.floor(Math.random() * 100) + 1,
      })));
    } catch (e) {
      console.error('Erro ao buscar lugares:', e);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: userLocation?.latitude || -25.42,
          longitude: userLocation?.longitude || -49.26,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapDrag}
        onPanDrag={handleMapDrag}
        customMapStyle={mapStyleSemHoteis}
      >
        {lugares.map((lugar) => (
          <Marker
            key={lugar.id}
            coordinate={{ latitude: lugar.latitude, longitude: lugar.longitude }}
            pinColor={getPinColor(lugar.lotacao)}
            onPress={() => setLugarSelecionado(lugar)}
          />
        ))}
      </MapView>

      {lugarSelecionado && (
        <View style={styles.balaoFixo}>
          <BalaoRestaurante
            nome={lugarSelecionado.nome}
            tipo={lugarSelecionado.tipo}
            lotacao={lugarSelecionado.lotacao}
            placeId={lugarSelecionado.id}
            foto={lugarSelecionado.foto ?
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${lugarSelecionado.foto}&key=${GOOGLE_API_KEY}` :
              null}
            onClose={() => setLugarSelecionado(null)}
          />
        </View>
      )}

      <TouchableOpacity style={styles.menuButton} onPress={toggleMenu}>
        <Feather name="menu" size={28} color="#333" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.searchButton} onPress={irParaBuscar}>
        <Feather name="search" size={26} color="#333" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.locationButton} onPress={centralizarLocal}>
        <MaterialIcons name="gps-fixed" size={24} color="#333" />
      </TouchableOpacity>

      <View style={styles.zoomContainer}>
        <TouchableOpacity style={styles.zoomButton} onPress={() => {
          if (mapRef.current && userLocation) mapRef.current.animateToRegion({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }}>
          <Text style={styles.zoomText}>＋</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.zoomButton} onPress={() => {
          if (mapRef.current && userLocation) mapRef.current.animateToRegion({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          });
        }}>
          <Text style={styles.zoomText}>－</Text>
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <TouchableWithoutFeedback onPress={toggleMenu}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View style={[styles.drawer, { left: slideAnim }]}>
        <View style={styles.profile}>
          <Image
            source={{ uri: `https://i.pravatar.cc/100?u=${user?.uid || 'usuario'}` }}
            style={styles.avatar}
          />
          <Text style={styles.welcome}>Olá, {nomeUsuario.split('@')[0]}</Text>
        </View>
        <View style={styles.menuItems}>
          <DrawerItem label="Início" icon="home" onPress={() => { }} />
          <DrawerItem label="Favoritos" icon="favorite" onPress={irParaFavoritos} />
          <DrawerItem label="Perfil" icon="person" onPress={() => { }} />
          <DrawerItem label="Sair" icon="logout" onPress={handleLogout} />
        </View>
      </Animated.View>

    </View>
  );
}

function DrawerItem({ label, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <MaterialIcons name={icon} size={22} color="#444" />
      <Text style={styles.menuLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  balaoFixo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 20,
    zIndex: 1000,
  },
  menuButton: {
    position: 'absolute', top: 50, left: 20,
    backgroundColor: 'white', padding: 8, borderRadius: 8, elevation: 4, zIndex: 10,
  },
  searchButton: {
    position: 'absolute', top: 50, right: 20,
    backgroundColor: 'white', padding: 8, borderRadius: 8, elevation: 4, zIndex: 10,
  },
  locationButton: {
    position: 'absolute', bottom: 40, right: 20,
    backgroundColor: 'white', padding: 10, borderRadius: 50, elevation: 5, zIndex: 10,
  },
  zoomContainer: {
    position: 'absolute', right: 20, bottom: 150,
    justifyContent: 'space-between', height: 100, zIndex: 10,
  },
  zoomButton: {
    backgroundColor: 'white', padding: 10, marginVertical: 5,
    borderRadius: 50, elevation: 5,
  },
  zoomText: { fontSize: 20, textAlign: 'center', color: '#333' },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, width: menuWidth,
    backgroundColor: '#fff', paddingTop: 80, paddingHorizontal: 20,
    elevation: 8, zIndex: 20,
  },
  overlay: {
    position: 'absolute', top: 0, bottom: 0,
    left: menuWidth, right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 15,
  },
  profile: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  welcome: { marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#333' },
  menuItems: { gap: 18 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  menuLabel: { fontSize: 16, color: '#333' },
});
