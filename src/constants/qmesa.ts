import Constants from 'expo-constants';

type QmesaExtraConfig = {
  qmesaPublicApiUrl?: string;
};

const extra = (Constants.expoConfig?.extra as QmesaExtraConfig | undefined) || {};

export const QMESA_PUBLIC_API_URL =
  process.env.EXPO_PUBLIC_QMESA_PUBLIC_API_URL ||
  extra.qmesaPublicApiUrl ||
  'https://api.qmesa.com.br/qmesa-public-api';
