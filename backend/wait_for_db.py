import asyncio

from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings


async def main() -> None:
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)
    async with engine.connect():
        pass
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
