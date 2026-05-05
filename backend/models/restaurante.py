from sqlalchemy import Column, String, Boolean, DateTime, Time, Numeric, Integer, SmallInteger, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base


class Restaurante(Base):
    __tablename__ = "restaurante"

    # Apenas dados proprietários — nome, endereço, etc. vêm do Google Places
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_place_id   = Column(String(255), unique=True, nullable=False)
    proprietario_id   = Column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    status_validacao  = Column(String(20), nullable=False, default="pendente")
    aceita_reservas   = Column(Boolean, nullable=False, default=True)
    ativo             = Column(Boolean, nullable=False, default=True)
    criado_em         = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relacionamentos
    proprietario  = relationship("Usuario", back_populates="restaurantes")
    cache         = relationship("RestauranteCache", back_populates="restaurante", uselist=False)
    imagens       = relationship("ImagemRestaurante", back_populates="restaurante", order_by="ImagemRestaurante.ordem")
    cardapios     = relationship("Cardapio", back_populates="restaurante")
    lotacoes      = relationship("Lotacao", back_populates="restaurante")
    reservas      = relationship("Reserva", back_populates="restaurante")
    avaliacoes    = relationship("Avaliacao", back_populates="restaurante")
    favoritos     = relationship("Favorito", back_populates="restaurante")
    notificacoes  = relationship("Notificacao", back_populates="restaurante")
    validacao     = relationship("ValidacaoRestaurante", back_populates="restaurante", uselist=False)
    convites      = relationship("ConviteRestaurante", back_populates="restaurante")
    historico     = relationship("HistoricoVisita", back_populates="restaurante")

    @property
    def nome(self):
        """Atalho para o nome vindo do cache do Google Places."""
        return self.cache.nome if self.cache else None

    @property
    def latitude(self):
        return self.cache.latitude if self.cache else None

    @property
    def longitude(self):
        return self.cache.longitude if self.cache else None

    @property
    def endereco(self):
        return self.cache.endereco if self.cache else None


class RestauranteCache(Base):
    """
    Armazena temporariamente os dados vindos da Google Places API.
    TTL: 24 horas. Após isso, o google_service.py atualiza automaticamente.
    Nunca edite esses campos manualmente — eles pertencem ao Google.
    """
    __tablename__ = "restaurante_cache"

    restaurante_id          = Column(UUID(as_uuid=True), ForeignKey("restaurante.id", ondelete="CASCADE"), primary_key=True)
    nome                    = Column(String(150), nullable=True)       # Google Places → name
    endereco                = Column(String, nullable=True)            # Google Places → formatted_address
    latitude                = Column(Numeric(10, 7), nullable=True)   # Google Places → geometry.location.lat
    longitude               = Column(Numeric(10, 7), nullable=True)   # Google Places → geometry.location.lng
    telefone                = Column(String(20), nullable=True)        # Google Places → formatted_phone_number
    site_url                = Column(String, nullable=True)            # Google Places → website
    categoria_culinaria     = Column(String(80), nullable=True)        # Google Places → types
    foto_url                = Column(String, nullable=True)            # Google Places → photos[0]
    horario_abertura        = Column(Time, nullable=True)              # Google Places → opening_hours
    horario_fechamento      = Column(Time, nullable=True)              # Google Places → opening_hours
    nota_google             = Column(Numeric(2, 1), nullable=True)    # Google Places → rating
    total_avaliacoes_google = Column(Integer, nullable=True)           # Google Places → user_ratings_total
    atualizado_em           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relacionamento
    restaurante = relationship("Restaurante", back_populates="cache")


class ImagemRestaurante(Base):
    """
    Imagens extras enviadas pelo proprietário via Firebase Storage.
    Diferente da foto_url do cache (que vem do Google), essas são próprias.
    """
    __tablename__ = "imagem_restaurante"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurante_id  = Column(UUID(as_uuid=True), ForeignKey("restaurante.id", ondelete="CASCADE"), nullable=False)
    storage_url     = Column(String, nullable=False)   # URL pública do Firebase Storage
    storage_path    = Column(String, nullable=False)   # Caminho interno (para deletar)
    tipo            = Column(String(20), nullable=False, default="galeria")
    ordem           = Column(SmallInteger, nullable=False, default=0)
    enviado_em      = Column(DateTime(timezone=True), server_default=func.now())

    # Relacionamento
    restaurante = relationship("Restaurante", back_populates="imagens")