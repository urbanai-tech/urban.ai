import os
import sys
import requests
import asyncio
from dotenv import load_dotenv
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from urban_webscrapping.utils.ticket_master_spider_helper import TicketMasterHelper
from urban_webscrapping.utils.urban_backend_client import UrbanBackendClient
from urban_webscrapping.pipelines import UrbanIngestPipeline

load_dotenv()

async def main():
    api_key = os.getenv("TICKETMASTER_API_KEY")
    if not api_key:
        print("No API Key")
        return

    url = f"https://app.ticketmaster.com/discovery/v2/events?apikey={api_key}&unit=km&locale=*&countryCode=BR&stateCode=SP&size=100&keyword=Jonas"
    
    response = requests.get(url)
    data = response.json()
    events = data.get("_embedded", {}).get("events", [])
    
    if not events:
        print("No Jonas events found on Ticketmaster!")
        return

    print(f"Found {len(events)} events.")
    
    helper = TicketMasterHelper()
    
    client = UrbanBackendClient.from_env(batch_size=1)
    client.api_base = "https://urbanai-production-85fd.up.railway.app"
    
    pipeline = UrbanIngestPipeline()
    # It will use pipeline._item_to_payload logic, but we can just map it ourselves quickly
    for raw_event in events:
        # helper process_event returns a dict like:
        # id, nome, linkSiteOficial, imagem_url, dataInicio, enderecoCompleto, postal_code, latitude, longitude
        e = helper.process_event(raw_event)
        print(f"Ingesting: {e.get('nome')}")
        
        payload = {
            "nome": str(e.get("nome")).strip(),
            "dataInicio": e.get("dataInicio"),
            "enderecoCompleto": str(e.get("enderecoCompleto")).strip(),
            "cidade": "São Paulo",
            "estado": "SP",
            "linkSiteOficial": e.get("linkSiteOficial"),
            "imagemUrl": e.get("imagem_url"),
            "source": "scraper-ticket_master",
            "crawledUrl": e.get("linkSiteOficial"),
            "latitude": e.get("latitude") or None,
            "longitude": e.get("longitude") or None
        }
        client.add_event(payload)

    client.flush()
    print("Done flush")

if __name__ == "__main__":
    asyncio.run(main())
