from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base


class Favorito(Base):
    __tablename__ = "favorito"
    __table_args__ = (
        UniqueConstraint("usuario_id", "restaurante_id", name="uq_favorito_usuario_restaurante"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    restaurante_id = Column(UUID(as_uuid=True), ForeignKey("restaurante.id", ondelete="CASCADE"), nullable=False)
    adicionado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    usuario = relationship("Usuario", back_populates="favoritos")
    restaurante = relationship("Restaurante", back_populates="favoritos")
