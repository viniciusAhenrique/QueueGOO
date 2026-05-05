from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid         = Column(String(128), unique=True, nullable=False)
    nome                 = Column(String(120), nullable=False)
    email                = Column(String(180), unique=True, nullable=False)
    telefone             = Column(String(20), nullable=True)
    foto_url             = Column(String, nullable=True)
    tipo_comida_favorito = Column(String(100), nullable=True)
    ativo                = Column(Boolean, nullable=False, default=True)
    conformidade_lgpd    = Column(Boolean, nullable=False, default=False)
    criado_em            = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relacionamentos
    restaurantes         = relationship("Restaurante", back_populates="proprietario")
    favoritos            = relationship("Favorito", back_populates="usuario")
    reservas             = relationship("Reserva", back_populates="usuario")
    avaliacoes           = relationship("Avaliacao", back_populates="usuario")
    historico            = relationship("HistoricoVisita", back_populates="usuario")
    notificacoes         = relationship("Notificacao", back_populates="usuario")
    preferencia_notif    = relationship("NotificacaoPreferencia", back_populates="usuario", uselist=False)
    filtros              = relationship("FiltroBusca", back_populates="usuario")
    amizades_enviadas    = relationship("Amizade", foreign_keys="Amizade.usuario_solicitante_id", back_populates="solicitante")
    amizades_recebidas   = relationship("Amizade", foreign_keys="Amizade.usuario_receptor_id", back_populates="receptor")
    convites_enviados    = relationship("ConviteRestaurante", foreign_keys="ConviteRestaurante.remetente_id", back_populates="remetente")
    convites_recebidos   = relationship("ConviteRestaurante", foreign_keys="ConviteRestaurante.destinatario_id", back_populates="destinatario")