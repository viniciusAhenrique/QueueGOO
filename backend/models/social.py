from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base


class Amizade(Base):
    __tablename__ = "amizade"

    id                     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_solicitante_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    usuario_receptor_id    = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    status                 = Column(String(20), nullable=False, default="pendente")  # pendente | aceita | bloqueada | recusada
    criado_em              = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamentos
    solicitante = relationship("Usuario", foreign_keys=[usuario_solicitante_id], back_populates="amizades_enviadas")
    receptor    = relationship("Usuario", foreign_keys=[usuario_receptor_id], back_populates="amizades_recebidas")


class ConviteRestaurante(Base):
    __tablename__ = "convite_restaurante"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    remetente_id     = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    destinatario_id  = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    restaurante_id   = Column(UUID(as_uuid=True), ForeignKey("restaurante.id", ondelete="CASCADE"), nullable=False)
    mensagem         = Column(Text, nullable=True)
    status           = Column(String(20), nullable=False, default="enviado")  # enviado | aceito | recusado | expirado
    enviado_whatsapp = Column(Boolean, nullable=False, default=False)
    link_whatsapp    = Column(Text, nullable=True)         # gerado pelo trigger do banco
    enviado_em       = Column(DateTime(timezone=True), server_default=func.now())
    respondido_em    = Column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    remetente    = relationship("Usuario", foreign_keys=[remetente_id], back_populates="convites_enviados")
    destinatario = relationship("Usuario", foreign_keys=[destinatario_id], back_populates="convites_recebidos")
    restaurante  = relationship("Restaurante", back_populates="convites")