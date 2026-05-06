import os
import time
import requests

API_KEY = "urban-scrapyd-2026-secret"
BASE_URL = "https://urbanai-production-3eb6.up.railway.app"
HEADERS = {"X-API-Key": API_KEY}
SPIDERS = [
    "blue_ticket",
    "even3",
    "eventim",
    "ingresse",
    "sympla",
    "ticket_360",
    "ticket_master"
]

def main():
    print("Scheduling all spiders...")
    jobs = {}
    for spider in SPIDERS:
        resp = requests.post(
            f"{BASE_URL}/schedule.json",
            headers=HEADERS,
            data={"project": "urban_webscrapping", "spider": spider}
        )
        if resp.status_code == 200:
            job_id = resp.json().get("jobid")
            jobs[spider] = job_id
            print(f"Scheduled {spider}: {job_id}")
        else:
            print(f"Failed to schedule {spider}: {resp.status_code} {resp.text}")

    print("\nWaiting for jobs to finish...")
    while True:
        resp = requests.get(f"{BASE_URL}/listjobs.json?project=urban_webscrapping", headers=HEADERS)
        if resp.status_code != 200:
            print(f"Error fetching listjobs: {resp.text}")
            time.sleep(10)
            continue
            
        data = resp.json()
        running_jobs = {job["id"] for job in data.get("running", [])}
        pending_jobs = {job["id"] for job in data.get("pending", [])}
        finished_jobs = {job["id"] for job in data.get("finished", [])}

        active = False
        for spider, job_id in jobs.items():
            if job_id in running_jobs or job_id in pending_jobs:
                active = True
                break

        if not active:
            break
            
        print(f"Still active: {len(running_jobs)} running, {len(pending_jobs)} pending")
        time.sleep(10)

    print("\nAll jobs finished! Fetching logs...")
    for spider, job_id in jobs.items():
        log_url = f"{BASE_URL}/logs/urban_webscrapping/{spider}/{job_id}.log"
        print(f"\n================ {spider} ===================")
        try:
            log_resp = requests.get(log_url, headers=HEADERS)
            if log_resp.status_code == 200:
                text = log_resp.text
                lines = text.splitlines()
                # Print last 30 lines of the log to see results
                for line in lines[-30:]:
                    print(line)
            else:
                print(f"Failed to get logs for {spider}: {log_resp.status_code}")
        except Exception as e:
            print(f"Error getting logs for {spider}: {e}")

if __name__ == "__main__":
    main()
