from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class WebAuthnOptionsRequest(BaseModel):
    # This might be empty or include user email
    email: Optional[str] = None

class WebAuthnRegistrationVerifyRequest(BaseModel):
    registration_response: Dict[str, Any]
    challenge: str

class WebAuthnLoginVerifyRequest(BaseModel):
    authentication_response: Dict[str, Any]
    challenge: str
    email: Optional[str] = None
