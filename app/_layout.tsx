import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <Stack>
      {/* Tela principal inicial */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="splash"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="welcome"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="cadastro"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="mapa"
        options={{
          title: 'Queue&Go',
          headerStyle: {
            backgroundColor: "#4FC3F7",
          },
          headerTintColor: "black",
          headerTitleAlign: "center",
        }}
      />
      <Stack.Screen
        name="restaurante"
        options={{
          headerStyle: {
            backgroundColor: "#4FC3F7",
          },
          headerTintColor: "black",
          headerTitleAlign: "center",
        }}
      />
      <Stack.Screen
        name="perfil"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="favoritos"
        options={{
          title: 'Favoritos',
          headerStyle: {
            backgroundColor: "#4FC3F7",
          },
          headerTintColor: "black",
          headerTitleAlign: "center",
        }}
      />
      <Stack.Screen
        name="BuscarLayer"
        options={{
          title: 'Buscar',
          headerStyle: {
            backgroundColor: "#4FC3F7",
          },
          headerTintColor: "black",
          headerTitleAlign: "center",
        }}
      />
    </Stack>
  );
}
