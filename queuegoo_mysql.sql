-- ============================================================
--  QueueGOO – Schema SQL (MySQL 8.0+)
--  Adaptado para Firebase Auth + Google Places API
--  Gerado em: 2026-03-19
--
--  Firebase Auth     → autenticação, sessão, login social
--  Firebase Storage  → fotos de perfil e restaurante
--  Firebase FCM      → push notifications (tokens gerenciados lá)
--  Google Places API → dados base do restaurante
--  Este banco        → lógica de negócio proprietária
-- ============================================================

CREATE DATABASE IF NOT EXISTS queuegoo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE queuegoo;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. USUARIO
-- ============================================================
CREATE TABLE usuario (
    id                   CHAR(36)      NOT NULL DEFAULT (UUID()),
    firebase_uid         VARCHAR(128)  NOT NULL,
    nome                 VARCHAR(120)  NOT NULL,
    email                VARCHAR(180)  NOT NULL,
    telefone             VARCHAR(20)   NULL,
    foto_url             TEXT          NULL,
    tipo_comida_favorito VARCHAR(100)  NULL,
    ativo                TINYINT(1)    NOT NULL DEFAULT 1,
    conformidade_lgpd    TINYINT(1)    NOT NULL DEFAULT 0,
    criado_em            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_firebase_uid (firebase_uid),
    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. RESTAURANTE
-- ============================================================
CREATE TABLE restaurante (
    id                CHAR(36)     NOT NULL DEFAULT (UUID()),
    google_place_id   VARCHAR(255) NOT NULL,
    proprietario_id   CHAR(36)     NOT NULL,
    status_validacao  VARCHAR(20)  NOT NULL DEFAULT 'pendente',
    aceita_reservas   TINYINT(1)   NOT NULL DEFAULT 1,
    ativo             TINYINT(1)   NOT NULL DEFAULT 1,
    criado_em         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_google_place_id (google_place_id),
    CONSTRAINT chk_status_validacao CHECK (status_validacao IN ('pendente','aprovado','reprovado','suspenso')),
    CONSTRAINT fk_restaurante_proprietario FOREIGN KEY (proprietario_id)
        REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_restaurante_status    ON restaurante (status_validacao);
CREATE INDEX idx_restaurante_ativo     ON restaurante (ativo);

-- ============================================================
-- 3. RESTAURANTE_CACHE
--    Cache dos dados vindos da Google Places API (TTL: 24h)
-- ============================================================
CREATE TABLE restaurante_cache (
    restaurante_id          CHAR(36)      NOT NULL,
    nome                    VARCHAR(150)  NULL,
    endereco                TEXT          NULL,
    latitude                DECIMAL(10,7) NULL,
    longitude               DECIMAL(10,7) NULL,
    telefone                VARCHAR(20)   NULL,
    site_url                TEXT          NULL,
    categoria_culinaria     VARCHAR(80)   NULL,
    foto_url                TEXT          NULL,
    horario_abertura        TIME          NULL,
    horario_fechamento      TIME          NULL,
    nota_google             DECIMAL(2,1)  NULL,
    total_avaliacoes_google INT           NULL,
    atualizado_em           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (restaurante_id),
    CONSTRAINT fk_cache_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. IMAGEM_RESTAURANTE
-- ============================================================
CREATE TABLE imagem_restaurante (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()),
    restaurante_id  CHAR(36)    NOT NULL,
    storage_url     TEXT        NOT NULL,
    storage_path    TEXT        NOT NULL,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'galeria',
    ordem           SMALLINT    NOT NULL DEFAULT 0,
    enviado_em      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_tipo_imagem CHECK (tipo IN ('capa','galeria','cardapio','ambiente')),
    CONSTRAINT fk_imagem_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_imagem_restaurante ON imagem_restaurante (restaurante_id, ordem);

-- ============================================================
-- 5. CARDAPIO
-- ============================================================
CREATE TABLE cardapio (
    id              CHAR(36)     NOT NULL DEFAULT (UUID()),
    restaurante_id  CHAR(36)     NOT NULL,
    nome_secao      VARCHAR(100) NOT NULL,
    ativo           TINYINT(1)   NOT NULL DEFAULT 1,
    ordem           SMALLINT     NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cardapio_secao (restaurante_id, nome_secao),
    CONSTRAINT fk_cardapio_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. ITEM_CARDAPIO
-- ============================================================
CREATE TABLE item_cardapio (
    id          CHAR(36)      NOT NULL DEFAULT (UUID()),
    cardapio_id CHAR(36)      NOT NULL,
    nome        VARCHAR(150)  NOT NULL,
    descricao   TEXT          NULL,
    preco       DECIMAL(10,2) NOT NULL,
    foto_url    TEXT          NULL,
    disponivel  TINYINT(1)    NOT NULL DEFAULT 1,
    ordem       SMALLINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT chk_preco CHECK (preco >= 0),
    CONSTRAINT fk_item_cardapio FOREIGN KEY (cardapio_id)
        REFERENCES cardapio(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_item_cardapio ON item_cardapio (cardapio_id, disponivel);

-- ============================================================
-- 7. LOTACAO
-- ============================================================
CREATE TABLE lotacao (
    id               CHAR(36)      NOT NULL DEFAULT (UUID()),
    restaurante_id   CHAR(36)      NOT NULL,
    nivel            VARCHAR(10)   NOT NULL,
    capacidade_total INT           NOT NULL,
    ocupacao_atual   INT           NOT NULL DEFAULT 0,
    -- coluna gerada: sintaxe MySQL
    percentual       DECIMAL(5,2)  GENERATED ALWAYS AS
                         (ROUND((ocupacao_atual / capacidade_total) * 100, 2)) STORED,
    atualizado_por   CHAR(36)      NULL,
    registrado_em    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_nivel_lotacao    CHECK (nivel IN ('verde','amarelo','vermelho')),
    CONSTRAINT chk_capacidade       CHECK (capacidade_total > 0),
    CONSTRAINT chk_ocupacao         CHECK (ocupacao_atual >= 0),
    CONSTRAINT fk_lotacao_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE,
    CONSTRAINT fk_lotacao_usuario FOREIGN KEY (atualizado_por)
        REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_lotacao_restaurante ON lotacao (restaurante_id, registrado_em DESC);

-- View lotação atual — MySQL não tem DISTINCT ON, usa subquery
CREATE OR REPLACE VIEW vw_lotacao_atual AS
SELECT l.*
FROM lotacao l
INNER JOIN (
    SELECT restaurante_id, MAX(registrado_em) AS ultimo
    FROM lotacao
    GROUP BY restaurante_id
) recente ON l.restaurante_id = recente.restaurante_id
         AND l.registrado_em  = recente.ultimo;

-- ============================================================
-- 8. RESERVA
-- ============================================================
CREATE TABLE reserva (
    id                 CHAR(36)    NOT NULL DEFAULT (UUID()),
    usuario_id         CHAR(36)    NOT NULL,
    restaurante_id     CHAR(36)    NOT NULL,
    data_reserva       DATE        NOT NULL,
    horario_reserva    TIME        NOT NULL,
    num_pessoas        SMALLINT    NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'pendente',
    codigo_confirmacao VARCHAR(12) NULL,
    observacoes        TEXT        NULL,
    criado_em          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_codigo_confirmacao (codigo_confirmacao),
    CONSTRAINT chk_num_pessoas CHECK (num_pessoas > 0),
    CONSTRAINT chk_status_reserva  CHECK (status IN ('pendente','confirmada','cancelada','concluida','no_show')),
    CONSTRAINT fk_reserva_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reserva_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_reserva_usuario     ON reserva (usuario_id, data_reserva);
CREATE INDEX idx_reserva_restaurante ON reserva (restaurante_id, data_reserva, status);

-- Trigger: gera código de confirmação ao inserir reserva
DELIMITER $$
CREATE TRIGGER trg_codigo_reserva
BEFORE INSERT ON reserva
FOR EACH ROW
BEGIN
    IF NEW.codigo_confirmacao IS NULL THEN
        SET NEW.codigo_confirmacao =
            UPPER(SUBSTR(MD5(CONCAT(NEW.id, NOW())), 1, 8));
    END IF;
END$$
DELIMITER ;

-- ============================================================
-- 9. AVALIACAO
-- ============================================================
CREATE TABLE avaliacao (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()),
    usuario_id      CHAR(36)    NOT NULL,
    restaurante_id  CHAR(36)    NOT NULL,
    reserva_id      CHAR(36)    NULL,
    nota            TINYINT     NOT NULL,
    comentario      TEXT        NULL,
    moderado        TINYINT(1)  NOT NULL DEFAULT 0,
    criado_em       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_avaliacao (usuario_id, restaurante_id, reserva_id),
    CONSTRAINT chk_nota CHECK (nota BETWEEN 1 AND 5),
    CONSTRAINT fk_avaliacao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_reserva FOREIGN KEY (reserva_id)
        REFERENCES reserva(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_avaliacao_restaurante ON avaliacao (restaurante_id, moderado);

CREATE OR REPLACE VIEW vw_media_avaliacoes AS
SELECT
    restaurante_id,
    ROUND(AVG(nota), 2) AS media_nota,
    COUNT(*)            AS total_avaliacoes
FROM avaliacao
WHERE moderado = 0
GROUP BY restaurante_id;

-- ============================================================
-- 10. FAVORITO
-- ============================================================
CREATE TABLE favorito (
    id              CHAR(36)  NOT NULL DEFAULT (UUID()),
    usuario_id      CHAR(36)  NOT NULL,
    restaurante_id  CHAR(36)  NOT NULL,
    adicionado_em   DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_favorito (usuario_id, restaurante_id),
    CONSTRAINT fk_favorito_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorito_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. HISTORICO_VISITA
-- ============================================================
CREATE TABLE historico_visita (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()),
    usuario_id      CHAR(36)    NOT NULL,
    restaurante_id  CHAR(36)    NOT NULL,
    data_visita     DATE        NOT NULL DEFAULT (CURRENT_DATE),
    origem          VARCHAR(20) NOT NULL DEFAULT 'manual',
    registrado_em   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_origem CHECK (origem IN ('manual','reserva','convite','check_in')),
    CONSTRAINT fk_historico_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_historico_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_historico_usuario ON historico_visita (usuario_id, data_visita DESC);

-- ============================================================
-- 12. AMIZADE
-- ============================================================
CREATE TABLE amizade (
    id                     CHAR(36)    NOT NULL DEFAULT (UUID()),
    usuario_solicitante_id CHAR(36)    NOT NULL,
    usuario_receptor_id    CHAR(36)    NOT NULL,
    status                 VARCHAR(20) NOT NULL DEFAULT 'pendente',
    criado_em              DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_amizade (usuario_solicitante_id, usuario_receptor_id),
    CONSTRAINT chk_status_amizade  CHECK (status IN ('pendente','aceita','bloqueada','recusada')),
    CONSTRAINT chk_auto_amizade    CHECK (usuario_solicitante_id <> usuario_receptor_id),
    CONSTRAINT fk_amizade_solicitante FOREIGN KEY (usuario_solicitante_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_amizade_receptor FOREIGN KEY (usuario_receptor_id)
        REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_amizade_receptor    ON amizade (usuario_receptor_id, status);
CREATE INDEX idx_amizade_solicitante ON amizade (usuario_solicitante_id, status);

-- ============================================================
-- 13. CONVITE_RESTAURANTE
-- ============================================================
CREATE TABLE convite_restaurante (
    id               CHAR(36)    NOT NULL DEFAULT (UUID()),
    remetente_id     CHAR(36)    NOT NULL,
    destinatario_id  CHAR(36)    NOT NULL,
    restaurante_id   CHAR(36)    NOT NULL,
    mensagem         TEXT        NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'enviado',
    enviado_whatsapp TINYINT(1)  NOT NULL DEFAULT 0,
    link_whatsapp    TEXT        NULL,
    enviado_em       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    respondido_em    DATETIME    NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_status_convite CHECK (status IN ('enviado','aceito','recusado','expirado')),
    CONSTRAINT chk_auto_convite   CHECK (remetente_id <> destinatario_id),
    CONSTRAINT fk_convite_remetente FOREIGN KEY (remetente_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_convite_destinatario FOREIGN KEY (destinatario_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_convite_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_convite_destinatario ON convite_restaurante (destinatario_id, status);
CREATE INDEX idx_convite_remetente    ON convite_restaurante (remetente_id);

-- Trigger: gera link WhatsApp ao inserir convite
DELIMITER $$
CREATE TRIGGER trg_link_whatsapp
BEFORE INSERT ON convite_restaurante
FOR EACH ROW
BEGIN
    DECLARE v_telefone  VARCHAR(20);
    DECLARE v_nome_rest VARCHAR(150);
    DECLARE v_telefone_limpo VARCHAR(20);
    DECLARE v_msg       TEXT;
    DECLARE v_msg_enc   TEXT;

    SELECT u.telefone INTO v_telefone
    FROM usuario u WHERE u.id = NEW.destinatario_id LIMIT 1;

    SELECT c.nome INTO v_nome_rest
    FROM restaurante_cache c WHERE c.restaurante_id = NEW.restaurante_id LIMIT 1;

    IF v_telefone IS NOT NULL THEN
        SET v_telefone_limpo = REGEXP_REPLACE(v_telefone, '[^0-9]', '');
        SET v_msg = COALESCE(
            NEW.mensagem,
            CONCAT('Oi! Te convido para ',
                   COALESCE(v_nome_rest, 'o restaurante'),
                   ' pelo QueueGOO!')
        );
        SET v_msg_enc = REPLACE(v_msg, ' ', '%20');
        SET NEW.link_whatsapp    = CONCAT('https://wa.me/', v_telefone_limpo, '?text=', v_msg_enc);
        SET NEW.enviado_whatsapp = 1;
    END IF;
END$$
DELIMITER ;

-- ============================================================
-- 14. NOTIFICACAO
-- ============================================================
CREATE TABLE notificacao (
    id              CHAR(36)     NOT NULL DEFAULT (UUID()),
    usuario_id      CHAR(36)     NOT NULL,
    restaurante_id  CHAR(36)     NULL,
    tipo            VARCHAR(40)  NOT NULL,
    titulo          VARCHAR(120) NOT NULL,
    corpo           TEXT         NOT NULL,
    lida            TINYINT(1)   NOT NULL DEFAULT 0,
    enviado_em      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_tipo_notificacao CHECK (tipo IN (
        'lotacao_verde','lotacao_amarela','lotacao_vermelha',
        'confirmacao_reserva','lembrete_reserva',
        'cancelamento_reserva','convite_recebido',
        'avaliacao_solicitada','novidade_restaurante'
    )),
    CONSTRAINT fk_notificacao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE,
    CONSTRAINT fk_notificacao_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_notificacao_usuario ON notificacao (usuario_id, lida, enviado_em DESC);

-- ============================================================
-- 15. NOTIFICACAO_PREFERENCIA
-- ============================================================
CREATE TABLE notificacao_preferencia (
    id                  CHAR(36)   NOT NULL DEFAULT (UUID()),
    usuario_id          CHAR(36)   NOT NULL,
    lotacao_verde       TINYINT(1) NOT NULL DEFAULT 1,
    lotacao_amarela     TINYINT(1) NOT NULL DEFAULT 1,
    lotacao_vermelha    TINYINT(1) NOT NULL DEFAULT 1,
    confirmacao_reserva TINYINT(1) NOT NULL DEFAULT 1,
    convites            TINYINT(1) NOT NULL DEFAULT 1,
    push_habilitado     TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_notif_pref_usuario (usuario_id),
    CONSTRAINT fk_notif_pref_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger: cria preferências padrão ao cadastrar usuário
DELIMITER $$
CREATE TRIGGER trg_criar_preferencias
AFTER INSERT ON usuario
FOR EACH ROW
BEGIN
    INSERT IGNORE INTO notificacao_preferencia (id, usuario_id)
    VALUES (UUID(), NEW.id);
END$$
DELIMITER ;

-- ============================================================
-- 16. FILTRO_BUSCA
-- ============================================================
CREATE TABLE filtro_busca (
    id               CHAR(36)      NOT NULL DEFAULT (UUID()),
    usuario_id       CHAR(36)      NOT NULL,
    nome_perfil      VARCHAR(80)   NOT NULL,
    distancia_max_km DECIMAL(5,2)  NULL DEFAULT 5.0,
    culinaria        VARCHAR(80)   NULL,
    nota_min         DECIMAL(2,1)  NULL DEFAULT 1.0,
    nivel_lotacao    VARCHAR(10)   NULL,
    apenas_abertos   TINYINT(1)    NOT NULL DEFAULT 1,
    salvo_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_nota_min       CHECK (nota_min BETWEEN 1 AND 5),
    CONSTRAINT chk_nivel_filtro   CHECK (nivel_lotacao IN ('verde','amarelo','vermelho')),
    CONSTRAINT fk_filtro_usuario  FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. ADMIN
-- ============================================================
CREATE TABLE admin (
    id           CHAR(36)    NOT NULL DEFAULT (UUID()),
    usuario_id   CHAR(36)    NOT NULL,
    nivel_acesso VARCHAR(20) NOT NULL DEFAULT 'moderador',
    criado_em    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_usuario (usuario_id),
    CONSTRAINT chk_nivel_acesso CHECK (nivel_acesso IN ('moderador','super_admin')),
    CONSTRAINT fk_admin_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. VALIDACAO_RESTAURANTE
-- ============================================================
CREATE TABLE validacao_restaurante (
    id              CHAR(36)    NOT NULL DEFAULT (UUID()),
    restaurante_id  CHAR(36)    NOT NULL,
    admin_id        CHAR(36)    NOT NULL,
    status          VARCHAR(20) NOT NULL,
    justificativa   TEXT        NULL,
    avaliado_em     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_validacao_restaurante (restaurante_id),
    CONSTRAINT chk_status_validacao_rest CHECK (status IN ('aprovado','reprovado','suspenso')),
    CONSTRAINT fk_validacao_restaurante FOREIGN KEY (restaurante_id)
        REFERENCES restaurante(id) ON DELETE CASCADE,
    CONSTRAINT fk_validacao_admin FOREIGN KEY (admin_id)
        REFERENCES admin(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trigger: atualiza status no restaurante ao validar
DELIMITER $$
CREATE TRIGGER trg_atualizar_status_restaurante
AFTER INSERT ON validacao_restaurante
FOR EACH ROW
BEGIN
    UPDATE restaurante
    SET status_validacao = NEW.status,
        atualizado_em    = NOW()
    WHERE id = NEW.restaurante_id;
END$$

CREATE TRIGGER trg_atualizar_status_restaurante_upd
AFTER UPDATE ON validacao_restaurante
FOR EACH ROW
BEGIN
    UPDATE restaurante
    SET status_validacao = NEW.status,
        atualizado_em    = NOW()
    WHERE id = NEW.restaurante_id;
END$$
DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEEDS
-- ============================================================
INSERT INTO usuario (id, firebase_uid, nome, email, conformidade_lgpd)
VALUES (UUID(), 'FIREBASE_UID_DO_ADMIN', 'Admin QueueGOO', 'admin@queuegoo.app', 1);

INSERT INTO admin (id, usuario_id, nivel_acesso)
SELECT UUID(), id, 'super_admin' FROM usuario WHERE email = 'admin@queuegoo.app';

-- ============================================================
-- VIEWS FINAIS
-- ============================================================

-- Mapa: consolida dados para os pins (cache Places API + lotação + avaliação)
CREATE OR REPLACE VIEW vw_restaurantes_mapa AS
SELECT
    r.id,
    r.google_place_id,
    c.nome,
    c.latitude,
    c.longitude,
    c.categoria_culinaria,
    c.foto_url,
    c.horario_abertura,
    c.horario_fechamento,
    c.nota_google,
    r.aceita_reservas,
    COALESCE(l.nivel, 'sem_dados')   AS nivel_lotacao,
    COALESCE(l.percentual, 0)        AS percentual_lotacao,
    COALESCE(av.media_nota, 0)       AS media_avaliacao_queuegoo,
    COALESCE(av.total_avaliacoes, 0) AS total_avaliacoes_queuegoo
FROM restaurante r
LEFT JOIN restaurante_cache    c  ON c.restaurante_id = r.id
LEFT JOIN vw_lotacao_atual     l  ON l.restaurante_id = r.id
LEFT JOIN vw_media_avaliacoes av  ON av.restaurante_id = r.id
WHERE r.status_validacao = 'aprovado'
  AND r.ativo = 1;

-- Perfil social do usuário
CREATE OR REPLACE VIEW vw_perfil_social AS
SELECT
    u.id,
    u.firebase_uid,
    u.nome,
    u.foto_url,
    u.tipo_comida_favorito,
    (SELECT COUNT(*) FROM amizade a
     WHERE (a.usuario_solicitante_id = u.id OR a.usuario_receptor_id = u.id)
       AND a.status = 'aceita')                        AS total_amigos,
    (SELECT COUNT(*) FROM favorito f
     WHERE f.usuario_id = u.id)                       AS total_favoritos,
    (SELECT COUNT(*) FROM reserva rv
     WHERE rv.usuario_id = u.id
       AND rv.status IN ('pendente','confirmada'))     AS reservas_ativas
FROM usuario u
WHERE u.ativo = 1;

-- ============================================================
-- FIM DO SCHEMA
-- ============================================================
