import os

import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("TICKETMASTER_API_KEY")

url = "https://app.ticketmaster.com/discovery/v2/events"
response = requests.get(
    url,
    params={"apikey": api_key, "keyword": "jonas", "countryCode": "BR"},
    timeout=20,
)
response.raise_for_status()

data = response.json()
events = data.get("_embedded", {}).get("events", [])
print(f"Fetched {len(events)} Ticketmaster events.")
