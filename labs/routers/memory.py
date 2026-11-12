from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from core.jwt_auth import get_current_user
from core.security import validate_admin_key
from labs.memory.memory_manager import memory_manager
from labs.profile_repository import profile_repo
from models.schemas import MerchantProfile

router = APIRouter(prefix="/memory", tags=["Memory Engine"], dependencies=[Depends(get_current_user)])

class MemoryUpdateRequest(BaseModel):
    canonical_name: str = Field(..., min_length=1, max_length=200)
    raw_text: str = Field(..., min_length=1, max_length=2000)

@router.post("/update", response_model=MerchantProfile, dependencies=[Depends(validate_admin_key)])
async def update_memory(request: MemoryUpdateRequest):
    """
    Ingests an entity encounter. Updates frequency and calculates state transitions.
    """
    profile = await memory_manager.process_encounter(
        canonical_name=request.canonical_name,
        raw_text=request.raw_text
    )
    return profile

@router.get("/profile/{canonical_name}", response_model=MerchantProfile)
async def get_profile(canonical_name: str = Path(..., min_length=1, max_length=200)):
    """
    Fetches the complete memory profile of an entity.
    """
    profile = await profile_repo.get_profile(canonical_name)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found in memory.")
    return profile

@router.get("/state/{canonical_name}")
async def get_memory_state(canonical_name: str = Path(..., min_length=1, max_length=200)):
    """
    Quickly returns just the current memory state of an entity.
    """
    profile = await profile_repo.get_profile(canonical_name)
    if not profile:
        return {"canonical_name": canonical_name, "memory_state": "UNSEEN"}

    return {
        "canonical_name": canonical_name,
        "memory_state": profile.memory_state,
        "frequency": profile.frequency
    }
