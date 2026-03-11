import os
import sys
import time

import httpx

URL = os.getenv("SCRAPE_URL", "https://urban-webscraping-production.up.railway.app/crawl.json")
params = {"spider_name": "eventim", "start_requests": "true"}

timeout = httpx.Timeout(30.0, connect=10.0)
with httpx.Client(timeout=timeout, http2=False) as client:
    start = time.time()
    try:
        r = client.get(URL, params=params)
        elapsed = time.time() - start
        print("status:", r.status_code, "elapsed:", elapsed)
        print("headers:", dict(r.headers))
        print("body (first 1000 chars):")
        print(r.text[:1000])
    except Exception as e:
        print("request failed:", repr(e))
        sys.exit(1)