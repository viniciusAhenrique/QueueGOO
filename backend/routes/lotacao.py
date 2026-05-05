from fastapi import APIRouter, Depends

from services.firebase_service import verificar_token
from services.google_service import get_lotacao_atual

router = APIRouter()


@router.get("/{place_id}")
def lotacao_atual(place_id: str, _=Depends(verificar_token)):
    return get_lotacao_atual(place_id)
