# Restore Drill Verification

Generated at: 2026-05-22T12:59:48.933Z
Mode: dry-run
Database: `mysql://[redacted]:[redacted]@<host>:3306/<database>`

## Summary

Pass: 0
Fail: 0
Planned: 5

| Check | Status | Duration | Detail |
| --- | --- | --- | --- |
| connection | PLANNED | 0ms | SELECT 1 against restored database |
| schema.expected_tables | PLANNED | 0ms | Verify 18 expected tables |
| schema.row_counts | PLANNED | 0ms | Read COUNT(*) from core tables |
| schema.latest_timestamps | PLANNED | 0ms | Read latest timestamps where available |
| auditability.tables_nonempty | PLANNED | 0ms | Verify admin_job_runs/admin_audit_logs are readable |

## Details

### connection

- Status: planned
- Description: SELECT 1 against restored database

### schema.expected_tables

- Status: planned
- Description: Verify 18 expected tables

### schema.row_counts

- Status: planned
- Description: Read COUNT(*) from core tables

### schema.latest_timestamps

- Status: planned
- Description: Read latest timestamps where available

### auditability.tables_nonempty

- Status: planned
- Description: Verify admin_job_runs/admin_audit_logs are readable

## Notes

- This verifier is read-only; it does not restore, migrate or mutate data.
- Use it after restoring a prod snapshot into staging or a temporary DB.
- Do not paste raw database URLs into evidence; this script redacts credentials.
