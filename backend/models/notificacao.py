from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base


class Notificacao(Base):
    __tablename__ = "notificacao"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id      = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    restaurante_id  = Column(UUID(as_uuid=True), ForeignKey("restaurante.id", ondelete="SET NULL"), nullable=True)
    tipo            = Column(String(40), nullable=False)
    titulo          = Column(String(120), nullable=False)
    corpo           = Column(String, nullable=False)
    lida            = Column(Boolean, nullable=False, default=False)
    enviado_em      = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    usuario     = relationship("Usuario", back_populates="notificacoes")
    restaurante = relationship("Restaurante", back_populates="notificacoes")


class NotificacaoPreferencia(Base):
    __tablename__ = "notificacao_preferencia"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id          = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), unique=True, nullable=False)
    lotacao_verde       = Column(Boolean, nullable=False, default=True)
    lotacao_amarela     = Column(Boolean, nullable=False, default=True)
    lotacao_vermelha    = Column(Boolean, nullable=False, default=True)
    confirmacao_reserva = Column(Boolean, nullable=False, default=True)
    convites            = Column(Boolean, nullable=False, default=True)
    push_habilitado     = Column(Boolean, nullable=False, default=True)

    # Relacionamento
    usuario = relationship("Usuario", back_populates="preferencia_notif")


class FiltroBusca(Base):
    __tablename__ = "filtro_busca"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id       = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    nome_perfil      = Column(String(80), nullable=False)
    distancia_max_km = Column(Numeric(5, 2), nullable=True, default=5.0)
    culinaria        = Column(String(80), nullable=True)
    nota_min         = Column(Numeric(2, 1), nullable=True, default=1.0)
    nivel_lotacao    = Column(String(10), nullable=True)  # verde | amarelo | vermelho
    apenas_abertos   = Column(Boolean, nullable=False, default=True)
    salvo_em         = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento
    usuario = relationship("Usuario", back_populates="filtros")