from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from config import SUPABASE_STORAGE_BUCKET
from database import get_supabase
from services.firebase_service import get_uid, verificar_token


router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024


@router.post("/imagem")
async def upload_imagem(
    path: str = Form(...),
    file: UploadFile = File(...),
    usuario_firebase=Depends(verificar_token),
):
    uid = get_uid(usuario_firebase)
    _validar_path(path, uid)

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem nao suportado.")

    conteudo = await file.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    if len(conteudo) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Imagem maior que 5 MB.")

    try:
        storage = get_supabase().storage.from_(SUPABASE_STORAGE_BUCKET)
        storage.upload(
            path,
            conteudo,
            file_options={
                "content-type": content_type,
                "upsert": "true",
            },
        )
        public_url = storage.get_public_url(path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao enviar imagem para Supabase Storage: {exc}",
        )

    return {
        "url": public_url,
        "path": path,
        "bucket": SUPABASE_STORAGE_BUCKET,
    }


@router.delete("/imagem")
async def deletar_imagem(
    path: str,
    usuario_firebase=Depends(verificar_token),
):
    uid = get_uid(usuario_firebase)
    _validar_path(path, uid)

    try:
        get_supabase().storage.from_(SUPABASE_STORAGE_BUCKET).remove([path])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro ao remover imagem do Supabase Storage: {exc}",
        )

    return {"mensagem": "Imagem removida.", "path": path}


def _validar_path(path: str, uid: str) -> None:
    prefixo = f"usuarios/{uid}/"
    if not path.startswith(prefixo):
        raise HTTPException(status_code=403, detail="Caminho de upload nao pertence ao usuario.")

    if ".." in path or path.startswith("/") or "\\" in path:
        raise HTTPException(status_code=400, detail="Caminho de upload invalido.")
