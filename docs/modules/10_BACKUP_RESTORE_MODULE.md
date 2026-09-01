# Backup Restore Module Documentation

## 1. Purpose

The Backup and Restore module protects application data from accidental loss.

It manages:

- Manual backups
- Automatic backups
- Database backups
- File backups
- Restore operations
- Backup verification


The goal is to ensure business continuity and data safety.


---

# 2. Module Overview

The application uses SQLite as the primary database.

Backup system protects:



SQLite Database

Application Files

Uploaded Documents

Configuration Data



---

# 3. Backup Workflow


## Manual Backup



Admin Clicks Backup

↓

System Creates Backup Package

↓

Database Export

↓

Files Copy

↓

Backup Validation

↓

Save Backup File

↓

Show Success Message



---

## Automatic Backup



Scheduled Time Reached

↓

Backup Service Starts

↓

Create Backup

↓

Verify Backup

↓

Store Backup

↓

Create Activity Log



---

# 4. Backup Types


## Full Backup


Includes:



Database

Images

Documents

Settings

Configuration



---

## Database Only Backup


Includes:



SQLite Database File



---

## File Backup


Includes:



Uploaded Images

Receipts

Attachments



---

# 5. Backup Frequency


System should support:



Daily

Weekly

Monthly

Custom Schedule



Example:



Every Day

02:00 AM



---

# 6. Backup Storage Location


Supported locations:


## Local Storage


Example:



Desktop Folder

External Drive



---

## Future Cloud Support


Possible:



Google Drive

OneDrive

Cloud Storage



---

# 7. Backup File Structure


Recommended format:



Backup_Name_Date.zip

Inside:

database/

database.sqlite

files/

images/

receipts/

config/

settings.json


---

# 8. Restore Workflow


Process:



User Selects Backup

↓

Validate Backup

↓

Confirm Restore

↓

Close Active Database

↓

Restore Files

↓

Restore Database

↓

Restart Application

↓

Verify Data



---

# 9. Restore Safety


Before restoring:


Create automatic safety backup.


Example:



Current Data

↓

Emergency Backup

↓

Restore Selected Backup



---

# 10. Backup Management


Users should manage:


Features:



View Backups

Create Backup

Delete Backup

Restore Backup

Download Backup



---

# 11. Backup List Interface


Table:



Backup Name

Date Created

Size

Type

Status

Actions



Actions:



Restore

Delete

Verify



---

# 12. Frontend Requirements


Required pages:



BackupSettingsPage

BackupManagerPage

RestoreDialog



Components:



BackupCard

BackupTable

ProgressIndicator

ConfirmDialog

FileSelector



---

# 13. UI Requirements


Backup interface should show:


## Backup Status


Example:



Last Backup:

Today 02:00 AM

Status:

Successful



---

## Progress Display


During backup:



Preparing Database...

Copying Files...

Creating Archive...

Completed



---

# 14. Backend Architecture


Structure:



commands/

backup_commands.rs

services/

backup_service.rs

restore_service.rs

repositories/

backup_repository.rs

utils/

file_manager.rs



---

# 15. Backup Service Responsibilities


Handles:


- Backup creation
- Compression
- File copying
- Scheduling
- Validation


---

# 16. Restore Service Responsibilities


Handles:


- Backup verification
- Database restoration
- File restoration
- Recovery process


---

# 17. Database Requirements


Backup metadata table:



backups



Fields:



id

file_name

backup_type

file_path

size

status

created_by

created_at



---

# 18. Backup Scheduler


The system should have background scheduling.


Responsibilities:


- Check backup timing
- Start backup automatically
- Handle failures


---

# 19. Error Handling


Backup failure:



Backup failed.

Please check storage space.



Restore failure:



Unable to restore backup.

Original data was not changed.



Invalid backup:



Backup file is corrupted.



---

# 20. Business Rules


## Rule 1

Only authorized users can restore backups.


---

## Rule 2

Restore operation requires confirmation.


---

## Rule 3

Successful and failed backups must be logged.


---

## Rule 4

System should never overwrite current data without confirmation.


---

# 21. Activity Logging


Record:



Backup Created

Backup Deleted

Backup Restored

Backup Failed



Include:



User

Date

Time

Action



---

# 22. Permissions


Required permissions:



backup.view

backup.create

backup.restore

backup.delete



Example:


Admin:


✓ Full access


Staff:


✗ No backup access


---

# 23. Testing Requirements


## Backend Tests


### Create Backup


Expected:



Backup file created successfully



---

### Restore Backup


Expected:



Data restored correctly



---

### Corrupted Backup


Expected:



Restore rejected



---

### Automatic Backup


Expected:



Backup runs on schedule



---

# Frontend Tests


Test:


✓ Backup button

✓ Progress display

✓ Backup list

✓ Restore confirmation

✓ Error messages


---

# 24. Performance Requirements


Backup system should:


- Handle large databases
- Avoid freezing UI
- Run operations in background


Required:


- Async processing
- Progress tracking
- File optimization


---

# 25. Security Requirements


Protect backups:


- Restrict access
- Validate files
- Prevent unauthorized restore
- Secure sensitive data


---

# 26. Future Improvements


Possible features:


- Cloud backup

- Automatic backup upload

- Backup encryption

- Backup health monitoring

- One-click recovery


---

# 27. Completion Checklist


Before completing Backup Restore module:


✓ Manual backup completed

✓ Automatic backup completed

✓ Restore completed

✓ Backup validation added

✓ Permissions added

✓ Activity logs added

✓ Tests completed

✓ Documentation updated

# 28. Implementation Status

Implemented (v1):

- **Database**
  - Migration `0008_backups` creates the `backups` metadata table (`file_name`, `backup_type`, `file_path`, `size`, `status`, `created_by`, `created_at`) plus a `created_at` index.
  - `Database` carries a `backups_dir` (`<app_data_dir>/backups/`, created on startup).

- **Backend**
  - `models/backup.rs`: `Backup`, `BackupType` (`full` | `database`), `BackupStatus` (`success` | `failed`).
  - `repositories/backup_repository.rs`: `insert`, `list`, `get_by_id`, `delete`, `count`.
  - `services/backup_service.rs`:
    - `write_backup` — consistent online snapshot via the SQLite backup API.
    - `create_backup` — managed backup with timestamped filename, verification, metadata row, activity log + notification.
    - `verify_backup` — opens the file, runs `PRAGMA integrity_check` and requires real table content.
    - `delete_backup` — removes the file and the metadata row.
    - `restore_backup` — validates the backup, writes an emergency `pre_restore_<ts>.db` safety copy, then restores into the live connection (no app restart required).
  - Commands (registered in `invoke_handler`): `create_backup`, `list_backups`, `get_backup`, `verify_backup`, `delete_backup`, `restore_backup` (by id).
  - 5 unit tests: create+metadata, restore round-trip, invalid/corrupted rejected, delete removes file+row, missing file rejected.

- **Frontend**
  - `types/backup.ts`, `services/backupService.ts`.
  - `pages/BackupManagerPage.tsx` at `/backups` (System nav): create with progress, list with size/status, verify, restore (confirmation modal), delete (confirmation modal), summary KPIs.
  - `SettingsPage` backup card now links to the Backup Manager.
  - `StatusBadge` extended with `success` / `failed` / `verified` mappings.

- **Not yet implemented**: automatic scheduled backups (daily/weekly/monthly), cloud storage, backup encryption, file-level (image/receipt) backups. Backups are DB-only (`database` type). Permissions (`backup.*`) are documented but not enforced — restore is gated by login session like the rest of the app.
