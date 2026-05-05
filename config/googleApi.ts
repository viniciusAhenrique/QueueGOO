/**
 * Configurações centralizadas da Google Maps API
 * A chave é lida das variáveis de ambiente (.env)
 */

// Chave da API - vem do arquivo .env
// Para acessar: GOOGLE_API_KEY
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "";

// URLs base da Google Places API
export const GOOGLE_PLACES_API_BASE =
  "https://maps.googleapis.com/maps/api/place";

// Endpoints
export const ENDPOINTS = {
  NEARBY_SEARCH: "/nearbysearch/json",
  PLACE_DETAILS: "/details/json",
  PLACE_PHOTO: "/photo",
};

// Função para construir URL de foto
export const getPlacePhotoUrl = (
  photoReference: string,
  maxWidth: number = 400,
): string => {
  return `${GOOGLE_PLACES_API_BASE}${ENDPOINTS.PLACE_PHOTO}?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${API_KEY}`;
};

// Função para buscar detalhes de um lugar
export const getPlaceDetailsUrl = (
  placeId: string,
  fields?: string,
): string => {
  const defaultFields =
    "name,rating,types,photos,formatted_address,formatted_phone_number,opening_hours";
  return `${GOOGLE_PLACES_API_BASE}${ENDPOINTS.PLACE_DETAILS}?place_id=${placeId}&fields=${fields || defaultFields}&key=${API_KEY}`;
};

// Função para buscar lugares próximos
export const getNearbySearchUrl = (
  latitude: number,
  longitude: number,
  radius: number = 3000,
  type: string = "restaurant",
  keyword?: string,
): string => {
  let url = `${GOOGLE_PLACES_API_BASE}${ENDPOINTS.NEARBY_SEARCH}?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${API_KEY}`;
  if (keyword) {
    url += `&keyword=${keyword}`;
  }
  return url;
};

// Exportar a chave para uso direto (se necessário)
export const GOOGLE_API_KEY = API_KEY;
