import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
      name="index"
      options={{
        headerShown: false
      }}
      />
      <Stack.Screen
      name="mapa"
      options={{
        title: 'Queu&Go',
        headerStyle: {
          backgroundColor: "#4FC3F7",
        },
        headerTintColor: "black",
        headerTitleAlign: "center",
      }}
      />
      <Stack.Screen
      name="madalosso"
      options={{
        title: 'Restaurante Madalosso',
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
