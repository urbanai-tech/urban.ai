import asyncio
import re
import json
from fastapi import FastAPI, HTTPException
from playwright.async_api import async_playwright

app = FastAPI(title="Urban AI - Hash Extractor", version="1.0")

# Cache to avoid excessive headless browser startups if requested exactly at the same time
cache_hash = None

async def extract_hash_via_playwright() -> str:
    async with async_playwright() as p:
        # Launch Chromium headless
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        found_hash = None
        
        # Function to intercept GraphQL responses
        async def handle_response(response):
            nonlocal found_hash
            if "graphql" in response.url.lower():
                try:
                    payload = await response.json()
                    # Just reading the URL and payload is sometimes not enough because the Hash is in the Request payload!
                except:
                    pass

        # To get the hash, we must intercept the REQUEST actually, since it's sent in the body or query params.
        async def handle_request(request):
            nonlocal found_hash
            if "graphql" in request.url.lower() or "contextualpublicprofilequery" in request.url.lower():
                try:
                    # Look for the hash directly in the URL
                    # URL format: /api/v3/ContextualPublicProfileQuery/<hash>?...
                    match = re.search(r'ContextualPublicProfileQuery/([\da-f]{64})', request.url)
                    if match:
                        found_hash = match.group(1)
                        print(f"Hash captured from URL: {found_hash}")
                    
                    # Also try post data if not in URL
                    post_data = request.post_data
                    if post_data and not found_hash:
                        data = json.loads(post_data)
                        if "extensions" in data and "persistedQuery" in data["extensions"]:
                            sha = data["extensions"]["persistedQuery"].get("sha256Hash")
                            if sha:
                                found_hash = sha
                except Exception as e:
                    pass

        # We listen to requests going out from the browser
        page.on("request", handle_request)
        
        # Navigate to a public host profile that we know exists and has listings
        # We use a random profile (any public profile works) to trigger the query
        print("Navigating to Airbnb profile to generate GraphQL queries...")
        try:
            await page.goto("https://www.airbnb.com.br/users/show/1462996042612541438", wait_until="networkidle", timeout=30000)
            
            # Wait deeply until the hash is populated or timeout
            for _ in range(10):
                if found_hash:
                    break
                await asyncio.sleep(1)
        except Exception as e:
            print(f"Error navigating: {e}")
        
        await browser.close()
        
        if not found_hash:
            raise Exception("Hash não encontrado no tráfego de rede durante a navegação.")
            
        return found_hash

@app.get("/get-airbnb-hash")
async def get_airbnb_hash():
    global cache_hash
    # Em um ambiente real nós podemos retornar do cache se for recente, 
    # mas o propósito dessa API já é ser chamada SOMENTE quando o hash morre.
    # Toda requisição a essa rota forçará uma navegação headless limpa.
    try:
        new_hash = await extract_hash_via_playwright()
        cache_hash = new_hash
        return {"success": True, "hash": new_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
