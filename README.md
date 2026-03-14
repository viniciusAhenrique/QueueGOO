# QueueGOO
Aplicativo mobile para consulta em tempo real do nível de movimentação de restaurantes próximos, com sistema de reservas, avaliações e notificações inteligentes.

# QueueGOO
Plataforma digital colaborativa que integra geolocalização e dados compartilhados pelos próprios usuários para indicar o nível de lotação de restaurantes (verde, amarelo ou vermelho). O sistema permite busca inteligente de estabelecimentos, reservas online, avaliações e notificações automáticas, promovendo conveniência, economia de tempo e melhor experiência na escolha de onde comer.

## Objetivos
### Objetivo Geral
Desenvolver um aplicativo mobile que permita visualizar, em tempo real, o nível de movimentação de restaurantes e realizar reservas de forma prática e segura.

### Objetivos Específicos
- Permitir cadastro de usuários e restaurantes.
- Exibir restaurantes próximos via integração com Google Maps.
- Indicar nível de lotação por ícones coloridos (verde, amarelo, vermelho).
- Permitir reservas com confirmação, reagendamento e cancelamento.
- Oferecer sistema de avaliações e feedback pós-reserva.
- Disponibilizar notificações push sobre mudanças de lotação.
- Garantir conformidade com LGPD e segurança de dados.
- Suportar login social (Google, Facebook etc.).

## Tecnologias Utilizadas

- Frontend: React Native
- Backend: Node.js
- Banco de Dados: Firebase
- Autenticação: Firebase Authentication
- Mapas e Geolocalização: Google Maps API
- Notificações Push: Firebase Cloud Messaging
- Armazenamento de Imagens: Firebase Storage ou AWS S3
- Testes: Jest + Cypress
- Prototipagem: Figma
- Gestão de Projeto: GitHub Projects (Kanban)

## Funcionalidades Principais

- Cadastro de usuários e restaurantes
- Login seguro e recuperação de senha
- Login social (Google/Facebook)
- Busca de restaurantes próximos via mapa
- Aplicação de filtros (distância, tipo de cozinha, avaliação etc.)
- Visualização do nível de movimentação em tempo real
- Compartilhamento de localização para alimentar dados de lotação
- Reserva de mesas
- Confirmação, reagendamento e cancelamento de reservas
- Histórico de reservas
- Lista de restaurantes favoritos
- Avaliação com nota e comentário
- Notificações push automáticas
- Painel administrativo para validação de restaurantes
- Requisitos Não Funcionais
- Comunicação segura via HTTPS
- Senhas criptografadas com bcrypt
- Conformidade com LGPD
- Tempo de resposta inferior a 2 segundos
- Escalabilidade horizontal
- Uptime mínimo de 99,5%
- Backups automáticos diários (retenção mínima de 30 dias)
- Compatibilidade com Android e iOS (duas versões anteriores)
- Cobertura mínima de 80% em testes automatizados

## Casos de Uso

Atores Principais:
- Usuário: busca restaurantes, realiza reservas, avalia e compartilha localização.
- Restaurante: gerencia cadastro e reservas recebidas.
- Administrador: valida cadastros e gerencia estabelecimentos.
- Sistema Externo: Google Maps API e serviço de notificações push.

## Exemplos de Casos de Uso

- Cadastrar Usuário
- Login / Login Social
- Buscar Restaurantes
- Aplicar Filtros
- Visualizar Nível de Movimentação
- Efetuar Reserva
- Gerenciar Reserva
- Avaliar Restaurante
- Salvar como Favorito
- Validar Credenciamento

## Testes

### Testes de Caixa-Preta
- Login com senha incorreta → exibir erro.
- Reserva de horário indisponível → bloquear agendamento.
- Cadastro com e-mail duplicado → impedir criação.
- Aplicação de múltiplos filtros → retorno correto.
- Compartilhamento de localização → atualização da lotação em tempo real.

### Testes de Aceitação
- Fluxo completo de busca → reserva → cancelamento.
- Cadastro e validação de restaurante pelo administrador.
- Bloqueio de restaurante e tentativa de login