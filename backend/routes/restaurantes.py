from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from database import get_db
from services.firebase_service import verificar_token
from services import google_service
from models.restaurante import Restaurante, RestauranteCache

router = APIRouter()


# ============================================================
# BUSCA (dados vêm do Google Places via google_service)
# ============================================================

@router.get("/proximos")
async def restaurantes_proximos(
    lat:             float = Query(..., description="Latitude do usuário"),
    lng:             float = Query(..., description="Longitude do usuário"),
    raio:            int   = Query(1500, description="Raio em metros"),
    tipo_culinaria:  str   = Query(None, description="Filtro por tipo ex: pizza, sushi"),
    _                = Depends(verificar_token),
):
    """
    Retorna restaurantes próximos ao usuário via Google Places Nearby Search.
    Usado para popular os pins no mapa.

    Exemplo: GET /restaurantes/proximos?lat=-25.4&lng=-49.2&raio=2000
    """
    try:
        return await google_service.buscar_restaurantes_proximos(lat, lng, raio, tipo_culinaria)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/buscar")
async def buscar_restaurantes(
    q:   str   = Query(..., description="Texto de busca"),
    lat: float = Query(None),
    lng: float = Query(None),
    _    = Depends(verificar_token),
):
    """
    Busca restaurantes por texto (nome, culinária, etc).
    Usado na barra de busca do app.

    Exemplo: GET /restaurantes/buscar?q=sushi&lat=-25.4&lng=-49.2
    """
    try:
        return await google_service.buscar_por_texto(q, lat, lng)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/geocodificar")
async def geocodificar(
    endereco: str = Query(...),
    _        = Depends(verificar_token),
):
    """
    Converte endereço digitado em coordenadas lat/lng.
    Exemplo: GET /restaurantes/geocodificar?endereco=Rua XV de Novembro, Curitiba
    """
    resultado = await google_service.geocodificar_endereco(endereco)
    if not resultado:
        raise HTTPException(status_code=404, detail="Endereço não encontrado.")
    return resultado


@router.get("/google/{place_id}")
async def get_restaurante_google(
    place_id: str,
    _        = Depends(verificar_token),
):
    """
    Retorna detalhes de um restaurante diretamente pelo Google Place ID.
    Usado pelo app quando o restaurante veio da busca/mapa e ainda nao esta
    cadastrado como restaurante proprietario no QueueGOO.
    """
    try:
        dados = await google_service.buscar_detalhes_por_place_id(place_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    if not dados:
        raise HTTPException(status_code=404, detail="Restaurante nao encontrado no Google Places.")

    return dados


# ============================================================
# DETALHES (combina dados do Google + dados do seu banco)
# ============================================================

@router.get("/{restaurante_id}")
async def get_restaurante(
    restaurante_id: str,
    db: Session = Depends(get_db),
    _           = Depends(verificar_token),
):
    """
    Retorna detalhes completos de um restaurante cadastrado no QueueGOO.
    Dados do Google (nome, endereço, fotos) vêm do cache de 24h.
    Dados proprietários (lotação, avaliações, reservas) vêm do banco.
    """
    restaurante = db.query(Restaurante).filter_by(id=restaurante_id, ativo=True).first()
    if not restaurante:
        raise HTTPException(status_code=404, detail="Restaurante não encontrado.")

    # Busca dados do Google (usa cache se válido)
    dados_google = await google_service.get_dados_restaurante(
        restaurante_id, restaurante.google_place_id, db
    )

    return {
        # Dados do SEU banco
        "id":               str(restaurante.id),
        "google_place_id":  restaurante.google_place_id,
        "aceita_reservas":  restaurante.aceita_reservas,
        "status_validacao": restaurante.status_validacao,

        # Dados do Google Places (via cache)
        **dados_google,
    }


# ============================================================
# CADASTRO (proprietário registra o restaurante pelo place_id)
# ============================================================

@router.post("/")
async def cadastrar_restaurante(
    dados: dict,
    usuario_firebase = Depends(verificar_token),
    db: Session      = Depends(get_db),
):
    """
    Proprietário cadastra o restaurante informando o google_place_id.
    O backend busca automaticamente os dados no Google Places.

    Body: { "google_place_id": "ChIJ..." }
    """
    place_id = dados.get("google_place_id")
    if not place_id:
        raise HTTPException(status_code=400, detail="google_place_id é obrigatório.")

    # Verifica se já está cadastrado
    existente = db.query(Restaurante).filter_by(google_place_id=place_id).first()
    if existente:
        raise HTTPException(status_code=409, detail="Restaurante já cadastrado no QueueGOO.")

    from models.usuario import Usuario
    from services.firebase_service import get_uid

    uid = get_uid(usuario_firebase)
    proprietario = db.query(Usuario).filter_by(firebase_uid=uid).first()
    if not proprietario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Cria o restaurante (status pendente — aguarda validação do admin)
    restaurante = Restaurante(
        google_place_id=place_id,
        proprietario_id=proprietario.id,
        status_validacao="pendente",
    )
    db.add(restaurante)
    db.commit()
    db.refresh(restaurante)

    # Busca e salva os dados do Google no cache imediatamente
    await google_service.get_dados_restaurante(str(restaurante.id), place_id, db)

    return {
        "id":              str(restaurante.id),
        "google_place_id": restaurante.google_place_id,
        "status":          restaurante.status_validacao,
        "mensagem":        "Restaurante cadastrado e aguardando validação.",
    }


@router.delete("/{restaurante_id}/cache")
async def invalidar_cache(
    restaurante_id: str,
    db: Session = Depends(get_db),
    _           = Depends(verificar_token),
):
    """
    Força atualização dos dados do Google na próxima consulta.
    Útil quando o proprietário atualiza o Google Meu Negócio.
    """
    await google_service.invalidar_cache(restaurante_id, db)
    return {"mensagem": "Cache invalidado. Dados serão atualizados na próxima consulta."}
