# ruff: noqa: F811  # pytest fixtures appear as redefinitions
"""
End-to-end tests for the complete data pipeline flow.

Tests the entire pipeline from S3 extraction through MySQL loading,
validating data integrity and processing correctness.
"""

from unittest.mock import patch

import pandas as pd

from raw_data_pipeline.extractors.s3_extractor import S3Extractor
from raw_data_pipeline.load.load_on_mysql import (
    load_dataframe_to_mysql,
    load_multiple_dataframes_to_mysql,
)
from raw_data_pipeline.main import main

# Import fixtures separately to avoid redefinition warnings
from .test_e2e_infrastructure import (  # noqa: F401
    E2ETestDatabase,
    E2ETestDataFactory,
    E2ETestS3,
    clean_database,
    e2e_database,
    e2e_s3,
    mock_aws_credentials,
    mock_prefect_secrets,
    populated_s3,
    test_data_factory,
)


class TestE2ECompleteFlow:
    """Test complete end-to-end data pipeline flow."""

    def test_s3_to_mysql_single_folder_flow(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test complete flow from S3 extraction to MySQL loading for single folder."""
        # Create test data
        test_df = E2ETestDataFactory.create_event_dataframe(50, "eventim")
        uploaded_files = e2e_s3.upload_test_data("eventim", [test_df])

        assert len(uploaded_files) == 1

        # Extract data using S3Extractor
        s3_extractor = S3Extractor()
        extracted_dataframes = s3_extractor.get_dataframes_from_folder("eventim")

        # Verify extraction
        assert len(extracted_dataframes) == 1
        extracted_df = extracted_dataframes[0]
        assert len(extracted_df) == 50
        assert "event_id" in extracted_df.columns
        assert "title" in extracted_df.columns

        # Load to MySQL
        rows_loaded = load_dataframe_to_mysql(
            df=extracted_df,
            table_name="eventim_test",
            if_exists="replace",
        )

        # Verify loading
        assert rows_loaded == 50
        assert clean_database.table_exists("eventim_test")

        # Verify data in database
        db_data = clean_database.get_table_data("eventim_test")
        assert len(db_data) == 50
        assert list(db_data.columns) == list(extracted_df.columns)

    def test_s3_to_mysql_multiple_folders_flow(
        self,
        clean_database: E2ETestDatabase,
        populated_s3: tuple[E2ETestS3, dict[str, list[str]]],
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test complete flow with multiple folders and datasets."""
        e2e_s3, uploaded_files = populated_s3

        # Should find 5 test folders: eventim, ticketmaster, blue_ticket,
        # even3, ingresse
        assert len(uploaded_files) == 5

        s3_extractor = S3Extractor()

        # Process each folder
        total_records_processed = 0
        tables_created = []

        for folder_name in uploaded_files:
            # Extract data
            dataframes = s3_extractor.get_dataframes_from_folder(folder_name)
            assert len(dataframes) == 3  # Each folder has 3 files

            # Load to MySQL
            table_name = folder_name.replace("-", "_").lower()
            total_rows = load_multiple_dataframes_to_mysql(
                dataframes=dataframes, table_name=table_name, if_exists="replace"
            )

            # Verify loading
            assert total_rows > 0
            assert clean_database.table_exists(table_name)
            tables_created.append(table_name)
            total_records_processed += total_rows

        # Verify all tables were created
        assert len(tables_created) == 5
        assert total_records_processed > 1000  # Should have lots of test data

        # Verify data integrity for one table
        eventim_data = clean_database.get_table_data("eventim")
        assert len(eventim_data) == 225  # 100 + 50 + 75 from test data factory
        assert "source" in eventim_data.columns
        assert all(eventim_data["source"] == "eventim")

    def test_s3_to_mysql_data_transformation_flow(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test flow including data transformation and type handling."""
        # Create test data with various data types
        test_data = pd.DataFrame(
            {
                "event_id": ["test_001", "test_002", "test_003"],
                "title": ["Event A", "Event B", "Event C"],
                "price": [100.50, 200.75, 150.25],
                "date": pd.to_datetime(["2024-12-01", "2024-12-02", "2024-12-03"]),
                "is_available": [True, False, True],
                "venue_id": [1, 2, 3],
            }
        )

        uploaded_files = e2e_s3.upload_test_data("test_types", [test_data])
        assert len(uploaded_files) == 1

        # Extract and load
        s3_extractor = S3Extractor()
        dataframes = s3_extractor.get_dataframes_from_folder("test_types")

        extracted_df = dataframes[0]

        rows_loaded = load_dataframe_to_mysql(
            df=extracted_df,
            table_name="type_test",
            if_exists="replace",
        )

        assert rows_loaded == 3

        # Verify data types are preserved
        db_data = clean_database.get_table_data("type_test")
        assert len(db_data) == 3
        assert db_data["price"].dtype.name.startswith("float")
        assert "date" in db_data.columns

    def test_s3_list_folders_integration(
        self,
        populated_s3: tuple[E2ETestS3, dict[str, list[str]]],
        mock_aws_credentials,
    ):
        """Test S3 folder listing integration."""
        e2e_s3, uploaded_files = populated_s3

        s3_extractor = S3Extractor()
        folders = s3_extractor.list_folders()

        # Should find all test folders
        expected_folders = set(uploaded_files.keys())
        actual_folders = set(folders)

        assert expected_folders.issubset(actual_folders)
        assert len(folders) >= 5

    def test_empty_folder_handling(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test handling of empty folders in S3."""
        s3_extractor = S3Extractor()

        # Try to extract from non-existent folder
        dataframes = s3_extractor.get_dataframes_from_folder("nonexistent")
        assert dataframes == []

        # Verify no tables were created
        assert not clean_database.table_exists("nonexistent")

    def test_database_connection_persistence(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test that database connections are properly managed across operations."""
        # Create test data
        test_df = E2ETestDataFactory.create_event_dataframe(10, "persistence")
        e2e_s3.upload_test_data("persistence_test", [test_df])

        s3_extractor = S3Extractor()

        # Perform multiple operations
        for i in range(3):
            dataframes = s3_extractor.get_dataframes_from_folder("persistence_test")
            rows_loaded = load_dataframe_to_mysql(
                df=dataframes[0],
                table_name=f"persistence_test_{i}",
                if_exists="replace",
            )
            assert rows_loaded == 10
            assert clean_database.table_exists(f"persistence_test_{i}")

        # Verify all tables exist
        for i in range(3):
            data = clean_database.get_table_data(f"persistence_test_{i}")
            assert len(data) == 10


class TestE2EMainPipelineFlow:
    """Test the main pipeline flow function."""

    @patch("raw_data_pipeline.main.S3Extractor")
    def test_main_pipeline_execution_mock(
        self,
        mock_s3_extractor_class,
        clean_database: E2ETestDatabase,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test main pipeline execution with mocked S3 extractor."""
        # Setup mock
        mock_s3_extractor = mock_s3_extractor_class.return_value
        mock_s3_extractor.list_folders.return_value = ["eventim", "ticketmaster"]

        # Create mock data for each folder
        eventim_data = E2ETestDataFactory.create_event_dataframe(50, "eventim")
        ticketmaster_data = E2ETestDataFactory.create_event_dataframe(
            30, "ticketmaster"
        )

        def mock_get_dataframes(folder):
            if folder == "eventim":
                return [eventim_data]
            elif folder == "ticketmaster":
                return [ticketmaster_data]
            return []

        mock_s3_extractor.get_dataframes_from_folder.side_effect = mock_get_dataframes

        # Run main pipeline
        main()

        # Verify results
        assert clean_database.table_exists("eventim")
        assert clean_database.table_exists("ticketmaster")

        eventim_db_data = clean_database.get_table_data("eventim")
        ticketmaster_db_data = clean_database.get_table_data("ticketmaster")

        assert len(eventim_db_data) == 50
        assert len(ticketmaster_db_data) == 30

    def test_main_pipeline_with_no_folders(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test main pipeline behavior when no folders are found."""
        # S3 is empty, so no folders should be found

        with patch("raw_data_pipeline.main.S3Extractor") as mock_s3_extractor_class:
            mock_s3_extractor = mock_s3_extractor_class.return_value
            mock_s3_extractor.list_folders.return_value = []

            # Should complete without error
            main()

            # No tables should be created
            # Note: We can't easily check this without listing all tables
            # but the test should pass without exceptions


class TestE2EDataIntegrity:
    """Test data integrity throughout the E2E flow."""

    def test_dataframe_column_preservation(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test that all DataFrame columns are preserved through the pipeline."""
        # Create DataFrame with specific columns
        original_df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "name": ["A", "B", "C"],
                "value": [10.5, 20.3, 30.7],
                "timestamp": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
                "category": ["X", "Y", "Z"],
            }
        )

        e2e_s3.upload_test_data("column_test", [original_df])

        # Extract
        s3_extractor = S3Extractor()
        extracted_dfs = s3_extractor.get_dataframes_from_folder("column_test")
        extracted_df = extracted_dfs[0]

        # Verify columns are preserved
        assert list(extracted_df.columns) == list(original_df.columns)
        assert len(extracted_df) == len(original_df)

        # Load to database
        load_dataframe_to_mysql(
            df=extracted_df,
            table_name="column_preservation_test",
            if_exists="replace",
        )

        # Verify in database
        db_data = clean_database.get_table_data("column_preservation_test")
        assert len(db_data) == 3
        # Note: Column order might change in database, but all should be present
        assert set(db_data.columns) == set(original_df.columns)

    def test_dataframe_row_count_accuracy(
        self,
        clean_database: E2ETestDatabase,
        e2e_s3: E2ETestS3,
        mock_prefect_secrets,
        mock_aws_credentials,
    ):
        """Test that row counts are accurate throughout the pipeline."""
        # Test with different row counts
        test_cases = [1, 10, 100, 1000]

        for row_count in test_cases:
            test_df = E2ETestDataFactory.create_event_dataframe(row_count, "count_test")

            e2e_s3.upload_test_data(f"count_test_{row_count}", [test_df])

            s3_extractor = S3Extractor()
            folder_name = f"count_test_{row_count}"
            extracted_dfs = s3_extractor.get_dataframes_from_folder(folder_name)

            assert len(extracted_dfs[0]) == row_count

            rows_loaded = load_dataframe_to_mysql(
                df=extracted_dfs[0],
                table_name=f"count_test_{row_count}",
                if_exists="replace",
            )

            assert rows_loaded == row_count

            db_data = clean_database.get_table_data(f"count_test_{row_count}")
            assert len(db_data) == row_count
