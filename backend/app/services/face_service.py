import base64
import binascii
import math
import os
import tempfile
from asyncio import to_thread
from pathlib import Path
from typing import Any, Sequence

from fastapi import HTTPException

from app.core.config import settings


class FaceService:
    @staticmethod
    async def enroll(student_id: int, image_base64: str) -> dict[str, Any]:
        return await to_thread(_enroll_face, student_id, image_base64)

    @staticmethod
    async def verify(student_id: int, image_base64: str, reference_embedding: Sequence[float] | None) -> dict[str, Any]:
        return await to_thread(_verify_face, student_id, image_base64, reference_embedding)


def _decode_image_to_file(image_base64: str, suffix: str = ".jpg") -> Path:
    payload = image_base64.strip()
    if "," in payload and payload.lower().startswith("data:"):
        payload = payload.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Image payload is too small")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(image_bytes)
    tmp.close()
    return Path(tmp.name)


def _deepface():
    os.environ.setdefault("DEEPFACE_HOME", settings.DEEPFACE_HOME)
    try:
        from deepface import DeepFace
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="DeepFace is not installed in the backend environment") from exc
    return DeepFace


def _check_real_face(image_path: Path) -> tuple[float | None, bool | None]:
    try:
        faces = _deepface().extract_faces(
            img_path=str(image_path),
            detector_backend=settings.FACE_DETECTOR_BACKEND,
            enforce_detection=settings.FACE_ENFORCE_DETECTION,
            align=True,
            anti_spoofing=settings.FACE_ANTI_SPOOFING,
        )
    except ValueError as exc:
        if settings.FACE_ANTI_SPOOFING and "install torch" in str(exc).lower():
            raise HTTPException(
                status_code=503,
                detail="Face anti-spoofing requires the optional torch dependency. Install backend requirements or set FACE_ANTI_SPOOFING=false.",
            ) from exc
        raise

    if len(faces) != 1:
        raise HTTPException(status_code=400, detail="Capture must contain exactly one face")

    face = faces[0]
    anti_spoofing_passed = face.get("is_real")
    if settings.FACE_ANTI_SPOOFING and anti_spoofing_passed is not True:
        raise HTTPException(status_code=400, detail="Face liveness check failed")

    confidence = face.get("confidence")
    return float(confidence) if confidence is not None else None, anti_spoofing_passed


def _extract_embedding(image_path: Path) -> tuple[list[float], float | None]:
    embedding_objs = _deepface().represent(
        img_path=str(image_path),
        model_name=settings.FACE_MODEL_NAME,
        detector_backend=settings.FACE_DETECTOR_BACKEND,
        enforce_detection=settings.FACE_ENFORCE_DETECTION,
        align=True,
        return_face=False,
    )
    if len(embedding_objs) != 1:
        raise HTTPException(status_code=400, detail="Capture must contain exactly one face")

    embedding = embedding_objs[0].get("embedding")
    if not isinstance(embedding, list) or not embedding:
        raise HTTPException(status_code=400, detail="Could not extract a face template")

    confidence = embedding_objs[0].get("face_confidence")
    return [float(value) for value in embedding], float(confidence) if confidence is not None else None


def _enroll_face(student_id: int, image_base64: str) -> dict[str, Any]:
    tmp_path = _decode_image_to_file(image_base64)
    try:
        face_confidence, anti_spoofing_passed = _check_real_face(tmp_path)
        embedding, embedding_confidence = _extract_embedding(tmp_path)
        return {
            "enrolled": True,
            "student_id": student_id,
            "embedding": embedding,
            "embedding_model": settings.FACE_MODEL_NAME,
            "embedding_dimensions": len(embedding),
            "face_confidence": face_confidence if face_confidence is not None else embedding_confidence,
            "anti_spoofing_passed": anti_spoofing_passed,
        }
    finally:
        tmp_path.unlink(missing_ok=True)


def _verify_face(student_id: int, image_base64: str, reference_embedding: Sequence[float] | None) -> dict[str, Any]:
    if not reference_embedding:
        raise HTTPException(status_code=404, detail="Student has no enrolled face template")

    tmp_path = _decode_image_to_file(image_base64)
    try:
        face_confidence, anti_spoofing_passed = _check_real_face(tmp_path)
        candidate_embedding, embedding_confidence = _extract_embedding(tmp_path)
        distance = _embedding_distance(reference_embedding, candidate_embedding, settings.FACE_DISTANCE_METRIC)
        threshold = settings.FACE_DISTANCE_THRESHOLD
        match_confidence = _match_confidence(distance, threshold, settings.FACE_DISTANCE_METRIC)
        match_threshold = settings.FACE_MATCH_CONFIDENCE_THRESHOLD
        return {
            "verified": distance <= threshold and match_confidence >= match_threshold,
            "student_id": student_id,
            "distance": distance,
            "threshold": threshold,
            "confidence": match_confidence,
            "match_threshold": match_threshold,
            "face_detection_confidence": face_confidence if face_confidence is not None else embedding_confidence,
            "model": settings.FACE_MODEL_NAME,
            "anti_spoofing_passed": anti_spoofing_passed,
        }
    finally:
        tmp_path.unlink(missing_ok=True)


def _embedding_distance(reference: Sequence[float], candidate: Sequence[float], metric: str) -> float:
    if len(reference) != len(candidate):
        raise HTTPException(status_code=400, detail="Face template dimensions do not match")

    if metric == "cosine":
        dot = sum(float(a) * float(b) for a, b in zip(reference, candidate))
        ref_norm = math.sqrt(sum(float(value) ** 2 for value in reference))
        candidate_norm = math.sqrt(sum(float(value) ** 2 for value in candidate))
        if ref_norm == 0 or candidate_norm == 0:
            raise HTTPException(status_code=400, detail="Face template is invalid")
        return 1 - (dot / (ref_norm * candidate_norm))

    if metric in {"euclidean", "euclidean_l2"}:
        return math.sqrt(sum((float(a) - float(b)) ** 2 for a, b in zip(reference, candidate)))

    raise HTTPException(status_code=500, detail=f"Unsupported face distance metric: {metric}")


def _match_confidence(distance: float, threshold: float, metric: str) -> float:
    if metric == "cosine":
        return max(0.0, min(100.0, (1 - distance) * 100))

    if threshold <= 0:
        return 0.0

    return max(0.0, min(100.0, (1 - (distance / threshold)) * 100))
