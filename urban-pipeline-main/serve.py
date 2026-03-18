import os
from prefect import serve
from prefect.blocks.system import Secret

from spiders_pipeline.main import trigger_all_spiders
from raw_data_pipeline.main import main as raw_data_pipeline_main

def load_secrets_to_env():
    """Load secrets from Prefect Blocks and set them in the environment."""
    try:
        print("Loading secrets from Prefect Blocks...")
        os.environ["DATABASE_URL"] = Secret.load("mysql-bronze-url").get()
        os.environ["AWS_ACCESS_KEY_ID"] = Secret.load("aws-access-key-id").get()
        os.environ["AWS_SECRET_ACCESS_KEY"] = Secret.load("aws-secret-access-key").get()
        os.environ["ASSUME_ROLE_ARN"] = Secret.load("aws-assume-role-arn").get()
        os.environ["ASSUME_ROLE_EXTERNAL_ID"] = Secret.load("aws-assume-role-external-id").get()
        os.environ["AWS_REGION"] = "us-east-2"
        os.environ["S3_BUCKET_NAME"] = "urban-ai-data"
        
        # SCRAPYD_URL was passed as job_variable previously
        os.environ["SCRAPYD_URL"] = os.environ.get("WEBSCRAPPING_API_URL", "https://urbanai-production-3eb6.up.railway.app")
        print("Secrets loaded successfully.")
    except Exception as e:
        print(f"Warning: Failed to load some secrets from Prefect: {e}")

if __name__ == "__main__":
    load_secrets_to_env()
    
    # Create deployments
    spiders_deployment = trigger_all_spiders.to_deployment(
        name="urban_webscraping",
        cron="0 3 * * *",
        tags=["urban"],
    )

    raw_data_deployment = raw_data_pipeline_main.to_deployment(
        name="raw_data_extraction_and_dump",
        cron="0 4 * * *",
        tags=["urban"],
    )

    # Start the serve process for all deployments
    print("Serving deployments natively without work pool...")
    serve(spiders_deployment, raw_data_deployment)
