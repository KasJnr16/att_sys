import asyncio
from sqlalchemy.future import select
from app.db.base import Base  # Ensure all models are loaded
from app.db.session import SessionLocal
from app.models.user import Role

async def seed_roles():
    async with SessionLocal() as session:
        result = await session.execute(select(Role))
        existing_roles = result.scalars().all()
        existing_names = [r.name for r in existing_roles]
        
        for role_name in ["admin", "lecturer", "student"]:
            if role_name not in existing_names:
                session.add(Role(name=role_name))
        
        await session.commit()

if __name__ == "__main__":
    asyncio.run(seed_roles())
