import httpx

CHECK_TIMEOUT_SECONDS = 15.0


def check_scrapyd_service(url: str, api_key: str = "") -> bool:
    """Retorna True só se o Scrapyd responder `status: ok` em /daemonstatus.json.

    O Scrapyd de produção fica atrás do auth proxy (`X-API-Key`); sem a chave o
    proxy responde 401 e o serviço pareceria "fora do ar" mesmo estando saudável.
    Qualquer falha (rede, HTTP, corpo que não é JSON) vira False.
    """
    headers = {"X-API-Key": api_key} if api_key else {}
    try:
        response = httpx.get(
            f"{url}/daemonstatus.json",
            headers=headers,
            timeout=CHECK_TIMEOUT_SECONDS,
        )
        if response.status_code == 200 and response.json().get("status") == "ok":
            print("Scrapyd service is up and running.")
            return True
        print("Scrapyd service is not up and running.")
        return False
    except (httpx.HTTPError, ValueError):
        return False
