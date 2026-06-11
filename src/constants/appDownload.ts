export const APP_DOWNLOAD_URL = process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL || '';
export const EVENT_LINK_BASE_URL = process.env.EXPO_PUBLIC_EVENT_LINK_BASE_URL || '';

export function criarBlocoDownloadApp() {
  if (!APP_DOWNLOAD_URL) return null;

  return [
    'Ainda nao tem o app?',
    `Baixe/teste o QueueGOO por aqui: ${APP_DOWNLOAD_URL}`,
  ].join('\n');
}

export function ehLinkExpoLocal(link?: string | null) {
  if (!link) return false;

  return (
    link.startsWith('exp://') ||
    link.includes('localhost') ||
    /\/\/(?:\d{1,3}\.){3}\d{1,3}[:/]/.test(link)
  );
}

export function criarLinkPublicoEvento(eventId: string) {
  if (!EVENT_LINK_BASE_URL || !eventId) return '';

  if (EVENT_LINK_BASE_URL.includes('{eventId}')) {
    return EVENT_LINK_BASE_URL.replace('{eventId}', encodeURIComponent(eventId));
  }

  const separador = EVENT_LINK_BASE_URL.includes('?') ? '&' : '?';
  return `${EVENT_LINK_BASE_URL}${separador}eventId=${encodeURIComponent(eventId)}`;
}
