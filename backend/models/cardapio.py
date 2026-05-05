from sqlalchemy import Column, String, Boolean, Numeric, SmallInteger, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from database import Base


class Cardapio(Base):
    __tablename__ = "cardapio"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id  = Column(UUID(as_uuid=True), ForeignKey("restaurante.id", ondelete="CASCADE"), nullable=False)
    nome_secao      = Column(String(100), nullable=False)
    ativo           = Column(Boolean, nullable=False, default=True)
    ordem           = Column(SmallInteger, nullable=False, default=0)

    # Relacionamentos
    restaurante = relationship("Restaurante", back_populates="cardapios")
    itens       = relationship("ItemCardapio", back_populates="cardapio", order_by="ItemCardapio.ordem")


class ItemCardapio(Base):
    __tablename__ = "item_cardapio"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cardapio_id = Column(UUID(as_uuid=True), ForeignKey("cardapio.id", ondelete="CASCADE"), nullable=False)
    nome        = Column(String(150), nullable=False)
    descricao   = Column(Text, nullable=True)
    preco       = Column(Numeric(10, 2), nullable=False)
    foto_url    = Column(String, nullable=True)
    disponivel  = Column(Boolean, nullable=False, default=True)
    ordem       = Column(SmallInteger, nullable=False, default=0)

    # Relacionamento
    cardapio = relationship("Cardapio", back_populates="itens")