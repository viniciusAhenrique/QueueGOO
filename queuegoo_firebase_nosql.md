# QueueGOO — Modelagem de Dados NoSQL (Firebase)

## Modelo Conceitual

O sistema é organizado em torno de duas entidades centrais: **usuário** e **restaurante**. Um usuário pode fazer reservas, avaliar restaurantes, salvar favoritos e convidar amigos. Um restaurante possui cardápio, registro de lotação e imagens. As demais entidades (amizades, convites, notificações) surgem da interação entre usuários e restaurantes.

Estratégias adotadas conforme modelagem NoSQL:
- Dados de perfil agregados no próprio documento do usuário
- Cardápio e lotação como sub coleções do restaurante
- Amizades, convites e notificações como coleções independentes com referências

---

## Modelo Lógico

### usuarios/{uid}
```
uid: String
nome: String
email: String
telefone: String | null
fotoUrl: String | null
tipoComidaFavorito: String | null
ativo: Boolean
conformidadeLgpd: Boolean
criadoEm: Timestamp
atualizadoEm: Timestamp

  subcoleção: preferenciasNotificacao/config
    lotacaoVerde: Boolean
    lotacaoAmarela: Boolean
    lotacaoVermelha: Boolean
    confirmacaoReserva: Boolean
    convites: Boolean
    pushHabilitado: Boolean

  subcoleção: reservas/{id}
    restauranteId: String
    googlePlaceId: String
    nomeRestaurante: String
    dataReserva: Timestamp
    horarioReserva: String
    numPessoas: Number
    status: String [pendente|confirmada|cancelada|concluida|no_show]
    codigoConfirmacao: String
    observacoes: String | null
    criadoEm: Timestamp
```

### restaurantes/{id}
```
googlePlaceId: String
proprietarioId: String
statusValidacao: String [pendente|aprovado|reprovado|suspenso]
aceitaReservas: Boolean
ativo: Boolean
criadoEm: Timestamp

  cache (mapa — dados da Google Places API)
    nome, endereco, latitude, longitude, telefone
    siteUrl, categoriaCulinaria, fotoUrl
    horarioAbertura, horarioFechamento
    notaGoogle, totalAvaliacoesGoogle
    cacheAtualizadoEm: Timestamp

  subcoleção: cardapio/{id}
    nomeSEcao: String
    ativo: Boolean
    ordem: Number

    subcoleção: itens/{id}
      nome, descricao, preco, fotoUrl, disponivel, ordem

  subcoleção: lotacoes/{id}
    nivel: String [verde|amarelo|vermelho]
    capacidadeTotal: Number
    ocupacaoAtual: Number
    percentual: Number
    atualizadoPor: String
    registradoEm: Timestamp

  subcoleção: avaliacoes/{id}
    usuarioId, nomeUsuario, fotoUsuarioUrl
    reservaId: String | null
    nota: Number (1–5)
    comentario: String | null
    moderado: Boolean
    criadoEm: Timestamp

  subcoleção: imagens/{id}
    storageUrl, storagePath
    tipo: String [capa|galeria|cardapio|ambiente]
    ordem: Number
```

### amizades/{id}
```
solicitanteId: String
receptorId: String
status: String [pendente|aceita|bloqueada|recusada]
criadoEm: Timestamp
```

### convites/{id}
```
remetenteId: String
destinatarioId: String
restauranteId: String
nomeRestaurante: String
mensagem: String | null
status: String [enviado|aceito|recusado|expirado]
enviadoWhatsapp: Boolean
linkWhatsapp: String | null
enviadoEm: Timestamp
respondidoEm: Timestamp | null
```

### notificacoes/{id}
```
usuarioId: String
restauranteId: String | null
tipo: String [lotacao_verde|lotacao_amarela|lotacao_vermelha|
              confirmacao_reserva|lembrete_reserva|cancelamento_reserva|
              convite_recebido|avaliacao_solicitada|novidade_restaurante]
titulo: String
corpo: String
lida: Boolean
enviadoEm: Timestamp
```

### favoritos/{id}
```
usuarioId: String
restauranteId: String
nomeRestaurante: String
fotoRestauranteUrl: String | null
adicionadoEm: Timestamp
```

### historico_visitas/{id}
```
usuarioId: String
restauranteId: String
nomeRestaurante: String
dataVisita: Timestamp
origem: String [manual|reserva|convite|check_in]
registradoEm: Timestamp
```

### admins/{id}
```
usuarioId: String
nivelAcesso: String [moderador|super_admin]
criadoEm: Timestamp
```

### validacoes_restaurante/{id}
```
restauranteId: String
adminId: String
status: String [aprovado|reprovado|suspenso]
justificativa: String | null
avaliadoEm: Timestamp
```

### filtros_busca/{id}
```
usuarioId: String
nomePerfil: String
distanciaMaxKm: Number
culinaria: String | null
notaMin: Number
nivelLotacao: String | null
apenasAbertos: Boolean
salvoEm: Timestamp
```

---

## Modelo Físico

### usuarios/abc123
```json
{
  "uid": "abc123",
  "nome": "João Silva",
  "email": "joao@email.com",
  "telefone": "+5541999990000",
  "fotoUrl": null,
  "tipoComidaFavorito": "Italiana",
  "ativo": true,
  "conformidadeLgpd": true,
  "criadoEm": "2026-03-19T10:00:00Z",
  "atualizadoEm": "2026-03-19T10:00:00Z"
}
```

### usuarios/abc123/reservas/rsv001
```json
{
  "restauranteId": "rest456",
  "googlePlaceId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "nomeRestaurante": "La Trattoria",
  "dataReserva": "2026-03-20T00:00:00Z",
  "horarioReserva": "20:00",
  "numPessoas": 2,
  "status": "confirmada",
  "codigoConfirmacao": "AB3F91C2",
  "observacoes": "Mesa perto da janela.",
  "criadoEm": "2026-03-19T10:30:00Z"
}
```

### restaurantes/rest456
```json
{
  "googlePlaceId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "proprietarioId": "owner789",
  "statusValidacao": "aprovado",
  "aceitaReservas": true,
  "ativo": true,
  "criadoEm": "2026-01-10T08:00:00Z",
  "cache": {
    "nome": "La Trattoria",
    "endereco": "Rua XV de Novembro, 450 - Centro",
    "latitude": -25.4284,
    "longitude": -49.2733,
    "telefone": "+554133330000",
    "categoriaCulinaria": "Italiana",
    "horarioAbertura": "11:30",
    "horarioFechamento": "23:00",
    "notaGoogle": 4.6,
    "cacheAtualizadoEm": "2026-03-19T06:00:00Z"
  }
}
```

### restaurantes/rest456/lotacoes/lot001
```json
{
  "nivel": "verde",
  "capacidadeTotal": 60,
  "ocupacaoAtual": 12,
  "percentual": 20.0,
  "atualizadoPor": "abc123",
  "registradoEm": "2026-03-19T19:45:00Z"
}
```

### convites/conv001
```json
{
  "remetenteId": "abc123",
  "destinatarioId": "xyz789",
  "restauranteId": "rest456",
  "nomeRestaurante": "La Trattoria",
  "status": "aceito",
  "enviadoWhatsapp": true,
  "linkWhatsapp": "https://wa.me/5541999990001?text=Oi!%20Te%20convido%20para%20La%20Trattoria!",
  "enviadoEm": "2026-03-19T18:00:00Z",
  "respondidoEm": "2026-03-19T18:05:00Z"
}
```
