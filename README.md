# QueueGOO

Aplicativo mobile colaborativo para consulta de restaurantes próximos, visualização de movimentação/lotação, reservas, favoritos, avaliações, notificações e recursos sociais para combinar encontros.

## 1. Identificação

### Projeto

QueueGOO - Plataforma para mapeamento de movimentação de restaurantes.

### Organização da equipe

| Integrante | Papel |
| --- | --- |
| Leandro Zeni | Desenvolvedor |
| Vinicius Andrade Henrique | Desenvolvedor |

### Data de início

13/02/2026, conforme a primeira sprint registrada no relatório de acompanhamento do projeto.

## 2. Concepção

### Visão geral

O QueueGOO auxilia usuários a escolherem restaurantes com mais praticidade, reunindo geolocalização, busca por estabelecimentos, indicadores de movimentação, reservas, favoritos, avaliações e notificações. A solução usa dados internos, integrações externas e informações de ocupação fornecidas pela parceria com o QMesa para melhorar a decisão do usuário antes de sair de casa.

### Objetivo do projeto

Desenvolver um aplicativo mobile que permita localizar restaurantes próximos, consultar informações de lotação/movimentação e apoiar a decisão do usuário por meio de filtros, detalhes do estabelecimento, favoritos, reservas e recursos sociais.

### Escopo do produto

#### Descrição do produto

O produto é composto por:

- Aplicativo mobile em React Native com Expo.
- Backend em FastAPI para autenticação complementar, restaurantes, lotação, uploads e diagnóstico.
- Integração com Firebase Authentication e Firestore.
- Integração com Supabase para catálogo, dados de apoio e armazenamento de imagens.
- Integrações com Google Maps/Places, Geoapify, TripAdvisor e API pública do QMesa.

#### Principais entregas

- Cadastro, login e perfil de usuário.
- Mapa com restaurantes próximos.
- Busca por texto e filtros de restaurantes.
- Tela de detalhes do restaurante.
- Indicadores de lotação/movimentação quando disponíveis.
- Favoritos.
- Reservas e consulta de reservas via integração interna ou QMesa, conforme disponibilidade.
- Feed social, amizades, chat e eventos.
- Notificações push e notificações internas.
- Upload de imagens.
- Backend FastAPI com rotas principais e checklist de produção.
- Documentação técnica, diagramas e roteiro de testes.

#### Critérios de aceite

- O usuário consegue criar conta, fazer login e sair do aplicativo.
- O mapa carrega e exibe restaurantes próximos quando há permissão de localização.
- A busca por texto e os filtros retornam estabelecimentos coerentes.
- A tela de detalhes apresenta dados úteis do restaurante.
- O usuário consegue salvar e remover favoritos.
- O app trata falhas de localização, internet e backend sem fechar inesperadamente.
- As rotas protegidas do backend validam token Firebase quando aplicável.
- O upload de imagens utiliza Supabase Storage.
- A documentação do projeto permanece atualizada conforme a arquitetura implementada.

### Matriz de riscos

| ID | Risco | Tipo | Impacto | Probabilidade | Resposta |
| --- | --- | --- | --- | --- | --- |
| R01 | Indisponibilidade ou limite de uso de APIs externas | Técnico | Alto | Média | Usar cache, fallback por catálogo interno/Supabase e tratamento de erro no app. |
| R02 | Divergência entre Firebase, Supabase e backend | Técnico | Alto | Média | Documentar responsabilidades de cada serviço e migrar rotas gradualmente. |
| R03 | Exposição de chaves ou credenciais | Técnico | Alto | Média | Usar variáveis de ambiente, EAS secrets e nunca incluir service account no APK. |
| R04 | Falhas de permissão de localização/notificações | Produto | Médio | Média | Exibir mensagens claras e manter fluxos alternativos sem travamento. |
| R05 | Escopo crescer além do tempo disponível | Projeto | Alto | Média | Priorizar MVP, registrar incrementos e manter backlog por sprint. |
| R06 | Testes insuficientes antes da entrega | Projeto | Alto | Média | Executar roteiro de testes funcionais, integração, erro, aceitação e stress. |
| R07 | Dados de lotação incompletos ou indisponíveis | Negócio | Médio | Média | Mostrar estado desconhecido quando necessário e enriquecer dados via QMesa/API externa. |

## 3. Design do software

### Design centrado no usuário

O projeto considera usuários que desejam reduzir tempo de escolha e evitar locais muito cheios. As telas principais priorizam acesso rápido a mapa, busca, filtros, detalhes do restaurante, favoritos, reservas e interação social.

### Personas e mapa de empatia

#### Persona 1 - Usuário final

- Precisa escolher rapidamente onde comer.
- Valoriza localização, avaliação, lotação e praticidade.
- Frustra-se quando chega a um restaurante cheio ou sem disponibilidade.

#### Persona 2 - Grupo de amigos

- Usa o app para combinar encontros.
- Precisa compartilhar locais, criar eventos e conversar antes da decisão.
- Valoriza notificações e organização em um único ambiente.

#### Persona 3 - Restaurante parceiro

- Precisa organizar fluxo, reservas e visibilidade.
- Valoriza previsibilidade e integração com ferramentas de fila/reserva.

### Storyboard

1. Usuário abre o app e faz login.
2. Permite localização.
3. Visualiza restaurantes próximos no mapa.
4. Aplica filtro ou pesquisa por tipo de comida.
5. Abre os detalhes de um restaurante.
6. Consulta lotação/movimentação, avaliação e informações externas.
7. Salva favorito, cria reserva ou compartilha em evento social.
8. Recebe notificações sobre interações, eventos ou mudanças relevantes.

### UI Design

O aplicativo usa uma interface mobile com navegação por telas, mapa como experiência principal, botões de ação para busca/favoritos/reservas/social e componentes visuais para cards, modais, feed, perfil, chat e eventos.

### Prototipação do MVP

A documentação do repositório contém diagramas e roteiro de testes. Caso o protótipo Quant-UX seja mantido fora do repositório, o link deve ser adicionado nesta seção junto com o roteiro de teste baseado nos critérios de aceite.

## 4. Desenvolvimento

### Processo de software

O projeto é acompanhado por sprints quinzenais, com organização inspirada em Scrum/Kanban e registro em relatório de acompanhamento.

### Tecnologias e recursos utilizados

#### Aplicativo mobile

- React Native
- Expo
- Expo Router
- TypeScript
- React Native Maps
- Expo Notifications
- Expo Location
- React Native Paper

#### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic
- HTTPX
- Firebase Admin SDK
- Supabase Client

#### Dados, autenticação e armazenamento

- Firebase Authentication
- Firebase Firestore
- Supabase/PostgreSQL
- Supabase Storage

#### Integrações

- Google Maps/Places
- Geoapify
- TripAdvisor
- QMesa Public API

#### Qualidade e build

- ESLint/Expo lint
- Jest/Expo preset configurado
- EAS Build
- Firebase rules
- Checklist de produção em `Documentation/production-checklist.md`

### Estado atual da arquitetura

- O app mobile consome o backend pela constante `API_BASE_URL`, configurada por `extra.apiUrl`, `EXPO_PUBLIC_API_URL` ou endereço local de desenvolvimento.
- O backend principal está em FastAPI e registra rotas de autenticação, restaurantes, lotação, uploads e diagnóstico.
- O Firebase é usado para autenticação, Firestore e validação de tokens no backend.
- O Supabase é usado como base principal para catálogo/dados de apoio e storage de mídia.
- Parte do código ainda mantém modelos SQLAlchemy e rotas em migração. Rotas que dependem de `get_db()` precisam ser migradas para Supabase Client antes de serem consideradas prontas para produção.
- As reservas podem aparecer por fluxos do aplicativo e por integração QMesa, mas a rota backend SQLAlchemy de reservas ainda não está registrada no `main.py` e não deve ser documentada como endpoint backend concluído.

### Resultados esperados

- Reduzir o tempo de escolha de restaurantes.
- Dar mais visibilidade sobre lotação, disponibilidade e detalhes úteis.
- Permitir organização social de encontros.
- Apoiar integração com QMesa para dados operacionais de restaurantes.
- Manter um backend modular, com segurança por token Firebase e variáveis de ambiente.

### Instruções para download e execução

#### Pré-requisitos

- Node.js
- npm
- Python 3.11 ou superior
- Expo CLI/EAS CLI quando necessário
- Projeto Firebase configurado
- Projeto Supabase configurado
- Chaves de API externas configuradas por variáveis de ambiente

#### Instalar dependências do app

```bash
npm install
```

#### Executar o app em desenvolvimento

```bash
npm start
```

Também é possível usar:

```bash
npm run android
npm run ios
npm run web
```

#### Instalar dependências do backend

```bash
cd backend
pip install -r requirements.txt
```

#### Executar o backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Variáveis de ambiente principais

- `APP_ENV`
- `DEBUG`
- `ALLOWED_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `GOOGLE_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` ou `FIREBASE_SERVICE_ACCOUNT_PATH`
- `EXPO_PUBLIC_API_URL`

### Licença de uso e distribuição

Licença ainda não definida. Antes de publicação externa, adicionar um arquivo `LICENSE` e atualizar esta seção.

## 5. Estratégia de marketing digital

A divulgação pode ser feita por landing page ou página de vendas com:

- Proposta de valor: encontrar restaurantes próximos com mais previsibilidade.
- Demonstração do mapa, filtros, lotação e recursos sociais.
- Benefícios para usuários: economia de tempo, melhor escolha e organização de encontros.
- Benefícios para restaurantes: visibilidade e integração com dados de fila/reserva.
- Chamada para teste do aplicativo.

## 6. Gestão do projeto

### MVP e incrementos

#### MVP

- Cadastro e login.
- Mapa com restaurantes próximos.
- Busca e filtros.
- Detalhes do restaurante.
- Favoritos.
- Indicador de movimentação/lotação quando disponível.

#### Incrementos

- Reservas.
- Feed social.
- Amizades.
- Chat.
- Eventos.
- Notificações push.
- Upload de imagens.
- Integração QMesa.
- Deploy e checklist de produção.

### Atividades do projeto

As atividades foram organizadas em sprints quinzenais e registradas no relatório de acompanhamento em `Documentation/QUEUEGOO - Relatório de Acompanhamento.pdf`.

### Cronograma

| Sprint | Período |
| --- | --- |
| Sprint 01 | 13/02/2026 a 26/02/2026 |
| Sprint 02 | 27/02/2026 a 12/03/2026 |
| Sprint 03 | 13/03/2026 a 26/03/2026 |
| Sprint 04 | 27/03/2026 a 09/04/2026 |
| Sprint 05 | 10/04/2026 a 23/04/2026 |
| Sprint 06 | 24/04/2026 a 07/05/2026 |
| Sprint 07 | 08/05/2026 a 21/05/2026 |
| Sprint 08 | 22/05/2026 a 04/06/2026 |
| Sprint 09 | 05/06/2026 a 18/06/2026 |

## 7. Métricas para monitoração e acompanhamento

- Percentual de cenários de teste aprovados.
- Tempo médio de resposta das buscas e detalhes de restaurantes.
- Taxa de erro das chamadas ao backend.
- Taxa de sucesso de login/cadastro.
- Taxa de sucesso de upload de imagens.
- Quantidade de restaurantes retornados por busca.
- Quantidade de favoritos, reservas, eventos e interações sociais.
- Falhas de integração com APIs externas.
- Uso de notificações e taxa de entrega quando disponível.

## 8. Relatório de encerramento e lições aprendidas

Seção pendente para preenchimento ao final do ciclo do projeto. Deve consolidar:

- Relatório técnico final.
- Principais decisões de arquitetura.
- Funcionalidades entregues.
- Limitações conhecidas.
- Lições aprendidas.
- Próximos incrementos recomendados.

## 9. Extras e artefatos relacionados

| Artefato | Local |
| --- | --- |
| Projeto da solução | `Documentation/QueueGOO_Projeto-da-Solucao.pdf` |
| Relatório de acompanhamento | `Documentation/QUEUEGOO - Relatório de Acompanhamento.pdf` |
| Roteiro de testes | `Documentation/QUEUEGOO - Roteiro de Testes.docx` |
| Diagrama de caso de uso | `Documentation/Use-Case-Diagram.png` |
| Diagrama de contexto | `Documentation/Context_Diagram.png` |
| Diagrama de classes | `Documentation/Class_Diagram.png` |
| Scripts Supabase | `Documentation/place-catalog-supabase.sql` e `Documentation/supabase-storage.sql` |
| Regras Firestore | `Documentation/firebase-firestore.rules` |
| Checklist de produção | `Documentation/production-checklist.md` |

## 10. Testes

O projeto possui roteiro de testes documentado em `Documentation/QUEUEGOO - Roteiro de Testes.docx`, cobrindo testes funcionais, integração, erro, aceitação e stress.

No código, há configuração de Jest com preset Expo, porém não foram identificados arquivos de testes automatizados versionados no padrão `*.test.*`, `*.spec.*` ou `__tests__`. Portanto, a cobertura mínima de 80% deve ser tratada como meta pendente até que testes automatizados sejam implementados e medidos.
