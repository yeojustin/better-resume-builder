import os

from supabase import Client, create_client

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_KEY", "")
supabase = None

if url and key and "your_" not in url:
    try:
        supabase: Client = create_client(url, key)
    except Exception as e:
        print(f"Failed to initialize Supabase: {e}")


def get_supabase_client():
    return supabase
