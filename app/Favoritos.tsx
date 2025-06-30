
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Link, RelativePathString } from 'expo-router';

const favoriteRestaurants = [
  { id: '1', name: 'Sushi Place', route: './madalosso.tsx' },
  { id: '2', name: 'Pasta Paradise', route: './madalosso.tsx' },
  { id: '3', name: 'Burger House', route: './madalosso.tsx' },
];

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Restaurantes Favoritos</Text>

      <FlatList
        data={favoriteRestaurants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={item.route as RelativePathString} asChild>
            <TouchableOpacity style={styles.card}>
              <Text style={styles.cardText}>{item.name}</Text>
            </TouchableOpacity>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4FC3F7',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 20,
    color: '#1e232c',
  },
  card: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e232c20',
  },
  cardText: {
    fontSize: 18,
    fontFamily: 'Urbanist_600SemiBold',
    color: '#1e232c',
  },
});
