import httpx


def check_scrapyd_service(url: str) -> bool:
    try:
        response = httpx.get(f"{url}/daemonstatus.json")
        if response.json().get("status") == "ok":
            print("Scrapyd service is up and running.")
            return True
        else:
            print("Scrapyd service is not up and running.")
            return False
    except httpx.HTTPError:
        return False
