import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("TICKETMASTER_API_KEY")

url = f"https://app.ticketmaster.com/discovery/v2/events?apikey={api_key}&keyword=jonas&countryCode=BR"
response = requests.get(url)

data = response.json()
events = data.get("_embedded", {}).get("events", [])
for e in events:
    print(e.get("name"))
    print("State:", e.get("_embedded", {}).get("venues", [{}])[0].get("state", {}).get("stateCode"))
    print("Source:", e.get("source", {}).get("name"))
