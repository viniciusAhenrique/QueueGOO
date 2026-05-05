import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extraApiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

function getExpoDevServerHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ||
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri;

  const host = hostUri?.split(':')[0];
  if (!host || ['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) {
    return null;
  }

  return host;
}

function normalizeUrl(url?: string | null) {
  return url?.replace(/\/$/, '');
}

const expoDevServerHost = getExpoDevServerHost();
const expoLanApiUrl = expoDevServerHost ? `http://${expoDevServerHost}:8000` : null;

const platformLocalApiUrl = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

export const API_BASE_URL = normalizeUrl(
  extraApiUrl || envApiUrl || expoLanApiUrl || platformLocalApiUrl || 'http://localhost:8000',
);
