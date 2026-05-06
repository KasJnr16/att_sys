import asyncio
import os

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.getenv("POSTGRES_SERVER", "db"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        database=os.getenv("POSTGRES_DB", "att_sys"),
    )
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
