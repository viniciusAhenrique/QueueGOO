# QueueGOO - checklist para teste de producao

## Firebase

- Firebase fica responsavel apenas por Auth/Firestore enquanto a migracao completa para Supabase nao termina.
- Imagens de perfil e posts nao usam Firebase Storage. O upload oficial e feito no Supabase Storage pelo bucket `queuegoo-media`.

- Fazer login e publicar regras atualizadas:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

- Conferir no Firebase Authentication se Email/Senha esta habilitado.
- Para Google Login, criar os OAuth Client IDs de Android/iOS/Web e preencher `extra.googleWebClientId`, `extra.googleAndroidClientId` e `extra.googleIosClientId` no `app.json` ou via EAS secrets.
- Ativar Firebase App Check antes de liberar teste externo amplo.
- Revogar qualquer `serviceAccountKey.json` que ja tenha sido exposto e usar `FIREBASE_SERVICE_ACCOUNT_JSON` no servidor.

## Backend

- Hospedagem recomendada para o teste de producao: Google Cloud Run.
  - O backend precisa ter uma URL HTTPS publica para o APK conseguir chamar a API.
  - A URL pode ser publica, mas as rotas do app devem validar o token Firebase no backend.
  - Nao use credenciais, chaves Google ou service account dentro do APK.

- Definir variaveis no ambiente do servidor:
  - `APP_ENV=production`
  - `DEBUG=false`
  - `ALLOWED_ORIGINS=https://seu-dominio.com`
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET=queuegoo-media`
  - `GOOGLE_API_KEY`
  - `FIREBASE_PROJECT_ID=queuegoo`
  - `FIREBASE_SERVICE_ACCOUNT_JSON`

- Nao subir `backend/.env` nem `backend/serviceAccountKey.json`.
- Guardar chaves sensiveis como variaveis/segredos do provedor, de preferencia Secret Manager no Cloud Run.
- Testar `/` e rotas principais depois do deploy.
- Depois do deploy, copiar a URL HTTPS do backend para `extra.apiUrl` no `app.json`.

## App

- Preencher `extra.apiUrl` no `app.json` com a URL publica do backend.
- Gerar build interno:

```bash
npx eas-cli login
npx eas-cli build --profile preview --platform android
```

- O perfil `preview` gera APK para instalacao direta em aparelhos Android.
- Enviar o link gerado pelo EAS para os testadores.
- No Android, permitir instalacao de apps desconhecidos quando o sistema pedir.

- Testar estes fluxos no build:
  - cadastro com foto;
  - login por email/senha;
  - alterar foto no perfil;
  - criar, editar, comentar e excluir post com foto;
  - feed com postagens de amigos;
  - pedido de amizade, aceite, recusa e lista de amigos;
  - perfil de amigo e chat direto;
  - criar evento, aceitar/recusar, conversar, remarcar, cancelar e excluir;
  - busca de restaurantes/mercados abertos;
  - reserva e notificacoes.
