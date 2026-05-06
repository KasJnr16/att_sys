import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings

@pytest.mark.asyncio
async def test_unauthorized_access():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"{settings.API_V1_STR}/lecturer/classes")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_admin_access_to_lecturer_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get(f"{settings.API_V1_STR}/lecturer/classes")
    assert response.status_code == 401
