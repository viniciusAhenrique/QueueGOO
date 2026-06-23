# QueueGOO: Plataforma Mobile para Consulta de Restaurantes com Indicadores de Movimentação e Recursos Sociais

## Resumo

Este artigo apresenta o QueueGOO, uma aplicação mobile desenvolvida para auxiliar usuários na escolha de restaurantes próximos por meio de geolocalização, busca, filtros, indicadores de movimentação/lotação, favoritos, notificações e recursos sociais. O projeto busca reduzir a incerteza na decisão sobre onde comer, reunindo informações dispersas em uma experiência única. A solução foi implementada com React Native, Expo, FastAPI, Firebase, Supabase e integrações externas como Google Maps/Places, Geoapify, TripAdvisor e QMesa Public API. O trabalho descreve o problema, a proposta de solução, a arquitetura adotada, as funcionalidades principais e os critérios de avaliação planejados.

Palavras-chave: aplicativo mobile; restaurantes; geolocalização; lotação; experiência do usuário; FastAPI; React Native.

## 1. Introdução

A escolha de restaurantes é uma atividade recorrente que envolve fatores como distância, avaliação, tipo de comida, disponibilidade, lotação e preferências sociais. Apesar da existência de plataformas de mapas, avaliações e delivery, a decisão presencial ainda pode exigir consulta a múltiplas fontes e comunicação informal entre usuários.

Nesse contexto, o QueueGOO foi concebido como uma plataforma mobile colaborativa para apoiar a escolha de restaurantes. O aplicativo reúne informações de localização, busca, detalhes do estabelecimento, movimentação, favoritos, reservas e interação social, permitindo ao usuário tomar decisões com mais praticidade.

## 2. Problema

Usuários frequentemente enfrentam dificuldade para saber se um restaurante está cheio, se vale a pena ir até o local ou qual alternativa próxima atende melhor suas preferências. Além disso, encontros em grupo costumam depender de conversas paralelas em outros aplicativos, dificultando a organização.

Do ponto de vista dos restaurantes, a falta de previsibilidade de demanda pode impactar a experiência de atendimento, principalmente em horários de pico. A integração com dados operacionais, como fila, ocupação e reservas, pode ajudar a reduzir essa lacuna informacional.

## 3. Objetivo

O objetivo do QueueGOO é desenvolver uma aplicação mobile capaz de:

- localizar restaurantes próximos ao usuário;
- permitir busca e filtros por estabelecimentos;
- apresentar detalhes relevantes sobre restaurantes;
- exibir indicadores de movimentação ou lotação quando disponíveis;
- permitir favoritos, notificações e recursos sociais;
- integrar dados externos e operacionais para enriquecer a experiência.

## 4. Metodologia

O desenvolvimento do projeto foi conduzido em sprints quinzenais, com acompanhamento registrado em relatório próprio. A metodologia adotada combinou práticas de organização ágil, revisão incremental de funcionalidades, atualização documental e validação por roteiro de testes.

As principais etapas foram:

1. levantamento de requisitos e definição do escopo;
2. estruturação do aplicativo mobile;
3. revisão e evolução da arquitetura backend;
4. integração com serviços externos;
5. criação de funcionalidades sociais e de notificação;
6. documentação técnica e planejamento de testes.

## 5. Arquitetura da solução

A arquitetura do QueueGOO é composta por um aplicativo mobile, um backend e serviços externos.

### 5.1 Aplicativo mobile

O aplicativo foi desenvolvido com React Native, Expo, Expo Router e TypeScript. Ele oferece telas de login, cadastro, mapa, busca, detalhes de restaurante, favoritos, perfil, feed social, chat, eventos e notificações.

### 5.2 Backend

O backend utiliza Python e FastAPI, com rotas para autenticação complementar, restaurantes, lotação, uploads e diagnóstico. A validação de autenticação utiliza tokens Firebase quando aplicável.

### 5.3 Persistência e serviços

O Firebase Authentication é usado para autenticação de usuários. O Firebase Firestore apoia dados sociais, favoritos e notificações internas. O Supabase/PostgreSQL e o Supabase Storage são usados para catálogo, dados de apoio e armazenamento de mídia.

### 5.4 Integrações externas

O projeto integra serviços como Google Maps/Places, Geoapify, TripAdvisor e QMesa Public API. Essas integrações permitem enriquecer dados de restaurantes, localização, avaliações, lotação e informações operacionais.

## 6. Funcionalidades principais

As principais funcionalidades implementadas ou planejadas para o MVP e incrementos são:

- cadastro e login de usuários;
- sincronização de primeiro acesso;
- mapa com restaurantes próximos;
- busca por texto e filtros;
- detalhes de restaurantes;
- favoritos;
- upload de imagens;
- feed social;
- amizades;
- chat;
- eventos;
- notificações push e internas;
- consulta de lotação e dados QMesa quando disponíveis.

## 7. Testes e avaliação

A avaliação do projeto foi planejada por meio de roteiro de testes funcionais, testes de integração, testes de interface, testes de erro, testes de aceitação e testes de stress.

Os critérios de aprovação incluem:

- login e cadastro funcionando corretamente;
- mapa carregando com localização;
- busca e filtros retornando resultados coerentes;
- favoritos e perfil funcionando sem erros críticos;
- fluxos sociais funcionando entre usuários;
- notificações registradas e exibidas corretamente;
- tratamento adequado de falhas comuns;
- estabilidade do aplicativo durante os fluxos principais.

## 8. Resultados esperados

Espera-se que o QueueGOO reduza o tempo de decisão do usuário, aumente a previsibilidade na escolha de restaurantes e melhore a organização de encontros sociais. Para restaurantes e parceiros, a solução pode ampliar visibilidade e permitir integração com dados operacionais relevantes.

## 9. Limitações

O projeto depende de disponibilidade e limites de APIs externas. Além disso, algumas rotas antigas baseadas em SQLAlchemy ainda estão em processo de migração para uso direto de Supabase Client. A qualidade dos dados de lotação também depende da disponibilidade de fontes integradas, como QMesa.

## 10. Conclusão

O QueueGOO demonstra a viabilidade de uma solução mobile voltada à escolha de restaurantes com apoio de geolocalização, dados de movimentação e recursos sociais. A proposta diferencia-se por combinar descoberta de locais, organização de encontros e integração com dados externos em uma única experiência. Como evolução futura, recomenda-se ampliar testes automatizados, consolidar a migração das rotas backend e validar o produto com usuários reais e restaurantes parceiros.

## Referências

- Documentação oficial do React Native.
- Documentação oficial do Expo.
- Documentação oficial do FastAPI.
- Documentação oficial do Firebase.
- Documentação oficial do Supabase.
- Documentação oficial do Google Maps Platform.
- Documentação oficial do Geoapify.
- Documentação do projeto QueueGOO.

