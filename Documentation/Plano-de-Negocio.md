# QueueGOO - Plano de Negócio

## 1. Resumo executivo

O QueueGOO é uma plataforma mobile colaborativa voltada à escolha de restaurantes, combinando geolocalização, busca por estabelecimentos, indicadores de movimentação/lotação, favoritos, reservas, avaliações, notificações e recursos sociais. O objetivo do produto é reduzir o tempo de decisão do usuário e melhorar a previsibilidade antes da chegada ao local.

A solução atende usuários finais que desejam encontrar restaurantes próximos com mais segurança de escolha e restaurantes/parceiros que podem se beneficiar de maior visibilidade, integração com dados operacionais e melhor organização da demanda.

## 2. Problema

Usuários frequentemente precisam decidir onde comer com pouca informação confiável sobre lotação, disponibilidade, localização, avaliações e conveniência. Essa decisão costuma exigir consulta a vários aplicativos, mensagens com amigos e tentativas manuais de contato com estabelecimentos.

Do lado dos restaurantes, a falta de previsibilidade sobre fluxo e reservas pode gerar espera desorganizada, desistência de clientes e dificuldades operacionais em horários de pico.

## 3. Solução proposta

O QueueGOO centraliza informações relevantes para a decisão do usuário em uma experiência mobile. O aplicativo permite:

- localizar restaurantes próximos;
- pesquisar e filtrar estabelecimentos;
- visualizar detalhes, avaliações e informações externas;
- consultar movimentação/lotação quando disponível;
- salvar favoritos;
- interagir socialmente por feed, amizades, chat e eventos;
- receber notificações;
- integrar dados de fila, lotação e reservas por meio da API pública do QMesa quando disponível.

## 4. Público-alvo

### Usuários finais

Pessoas que frequentam restaurantes, bares, cafés e estabelecimentos gastronômicos e desejam tomar decisões mais rápidas sobre onde ir.

### Grupos de amigos

Usuários que combinam encontros e precisam compartilhar opções, conversar e organizar eventos em torno de locais de alimentação.

### Restaurantes e parceiros

Estabelecimentos que desejam ampliar visibilidade, melhorar previsibilidade de atendimento e integrar dados operacionais de fila, ocupação e reservas.

## 5. Proposta de valor

### Para usuários

- Economia de tempo na escolha do local.
- Consulta rápida de restaurantes próximos.
- Mais previsibilidade sobre movimentação e disponibilidade.
- Organização social de encontros em um único app.
- Favoritos e notificações para acompanhar locais de interesse.

### Para restaurantes

- Maior exposição para usuários próximos.
- Possibilidade de integração com dados operacionais.
- Apoio à gestão de demanda e reservas.
- Melhoria na experiência do cliente antes da chegada ao local.

## 6. Diferenciais

- Integração entre mapa, busca, lotação e recursos sociais.
- Uso combinado de dados internos, APIs externas e integração QMesa.
- Foco em decisão rápida do usuário, não apenas em listagem de estabelecimentos.
- Possibilidade de evoluir para recursos de recomendação, campanhas e inteligência operacional.

## 7. Modelo de receita

O projeto pode evoluir para os seguintes modelos:

| Modelo | Descrição |
| --- | --- |
| Freemium para usuários | Uso gratuito com recursos avançados opcionais no futuro. |
| Assinatura para restaurantes | Plano mensal para restaurantes com destaque, métricas e integração ampliada. |
| Destaque patrocinado | Restaurantes podem aparecer em posições promocionais identificadas. |
| Parcerias B2B | Integração com plataformas de fila, reserva, cardápio ou gestão gastronômica. |
| Dados agregados | Relatórios estatísticos sem dados pessoais identificáveis, respeitando LGPD. |

## 8. Análise de mercado

O mercado de alimentação fora de casa depende cada vez mais de decisões digitais. Usuários consultam avaliações, mapas, redes sociais e aplicativos de entrega antes de escolher um estabelecimento. Ainda assim, a informação sobre lotação e organização da experiência presencial costuma ser limitada.

O QueueGOO atua nesse espaço ao unir localização, movimentação, socialização e decisão em um único produto. A solução não concorre diretamente com delivery ou ERP de restaurante; seu foco é a experiência de escolha e ida ao local.

## 9. Concorrentes e alternativas

| Alternativa | Pontos fortes | Limitações em relação ao QueueGOO |
| --- | --- | --- |
| Google Maps | Ampla base de locais, avaliações e rotas. | Não foca em interação social, eventos ou lotação operacional integrada. |
| Apps de delivery | Cardápio, pagamento e entrega. | Foco em consumo remoto, não na escolha presencial. |
| WhatsApp/Instagram | Comunicação direta e divulgação. | Informação dispersa e sem mapa/filtro/lotação integrados. |
| Sistemas de fila/reserva | Gestão operacional do restaurante. | Normalmente não entregam experiência ampla de descoberta para usuários finais. |

## 10. Estratégia de entrada no mercado

1. Validar o MVP com usuários próximos ao ambiente acadêmico e restaurantes locais.
2. Demonstrar o app em apresentação e testes orientados.
3. Usar uma landing page simples com proposta de valor, capturas do app e chamada para teste.
4. Buscar parceria com restaurantes que já utilizam ou podem utilizar QMesa.
5. Coletar feedback sobre busca, mapa, lotação, favoritos e organização social.

## 11. Marketing e divulgação

### Canais iniciais

- Redes acadêmicas e grupos locais.
- Demonstrações presenciais.
- Landing page do produto.
- Divulgação para restaurantes parceiros.
- Apresentação em eventos institucionais.

### Mensagem central

O QueueGOO ajuda o usuário a escolher onde comer com mais rapidez, previsibilidade e organização.

## 12. Operação e recursos necessários

### Recursos humanos

- Desenvolvimento mobile.
- Desenvolvimento backend.
- Manutenção de integrações.
- Testes e validação com usuários.
- Documentação e apresentação do projeto.

### Recursos técnicos

- Firebase Authentication e Firestore.
- Supabase/PostgreSQL e Supabase Storage.
- Backend FastAPI.
- Google Maps/Places.
- Geoapify.
- TripAdvisor.
- QMesa Public API.
- EAS Build para geração de builds.

## 13. Custos previstos

| Categoria | Exemplos |
| --- | --- |
| Infraestrutura | Hospedagem do backend, banco, storage e domínios. |
| APIs externas | Google Maps/Places, Geoapify e serviços complementares. |
| Distribuição | Build, testes em dispositivos e publicação futura. |
| Operação | Monitoramento, manutenção e suporte. |
| Marketing | Landing page, materiais de divulgação e ações com restaurantes. |

## 14. Indicadores de sucesso

- Número de usuários cadastrados.
- Taxa de sucesso de login/cadastro.
- Quantidade de buscas realizadas.
- Quantidade de restaurantes visualizados.
- Uso de favoritos.
- Uso de eventos e recursos sociais.
- Taxa de erro das integrações externas.
- Tempo médio de resposta das buscas.
- Feedback qualitativo dos usuários.

## 15. Riscos do negócio

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Dependência de APIs externas | Alto | Uso de cache, fallback e tratamento de indisponibilidade. |
| Baixa adesão de restaurantes | Médio | Iniciar com parceiros locais e proposta clara de valor. |
| Dados de lotação incompletos | Médio | Exibir estado desconhecido e integrar fontes como QMesa. |
| Custos de APIs | Médio | Limitar chamadas, cachear resultados e monitorar uso. |
| Concorrência de plataformas consolidadas | Médio | Focar em integração social e lotação, que são diferenciais. |

## 16. Considerações finais

O QueueGOO apresenta potencial como solução de apoio à decisão para usuários e ferramenta complementar de visibilidade para restaurantes. O projeto combina tecnologias mobile, backend, serviços externos e integração com QMesa para entregar uma experiência mais completa do que a simples consulta de restaurantes em mapa.

