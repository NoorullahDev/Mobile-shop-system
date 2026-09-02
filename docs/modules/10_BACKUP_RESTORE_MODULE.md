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

---

# 29. Implementation Status (v2) — Automatic Backup System

Implemented (v2), complete against the SRS requirements:

- **Storage location**
  - Backups are now written as compressed `.zip` archives to `Desktop\Software Backup\` (resolved from `USERPROFILE` so it works in dev and the packaged EXE).
  - File naming: `Auto_Backup_<YYYY-MM-DD_HH-MM>.zip` for automatic/exit backups, `Manual_Backup_<YYYY-MM-DD_HH-MM>.zip` for the manual "Create Backup Now" action.
  - Each archive contains `business_management.db` (consistent online SQLite snapshot) plus `backup_info.json` (a manifest with app name, created-at timestamp). Because member images, expense receipts, the shop logo, settings and configuration all live inside the SQLite DB, the archive satisfies "database + images/files + settings + config + system data".

- **Backend**
  - `services/backup_service.rs`:
    - `desktop_folder()` — resolves/creates `Desktop\Software Backup`.
    - `write_zip(conn, destination)` — packs the DB snapshot + manifest manifest into a deflated zip.
    - `create_backup` — now produces the `.zip` archives above, with the prefix driven by `BackupType` (`Full` → `Manual_Backup_`, `Database` → `Auto_Backup_`); still verifies, records metadata, and logs activity + notification.
    - `verify_backup_entry` — verifies a backup, extracting the embedded snapshot first when the file is a `.zip`.
    - `restore_backup` — detects `.zip` sources, extracts the snapshot to a temp file, verifies, writes the `pre_restore_*.db` safety copy, then restores; cleans up the temp file.
    - `get_config` / `update_config` — reads/writes auto-backup settings keys (`auto_backup_enabled`, `auto_backup_interval_minutes`, `backup_folder`) in the `settings` table, defaulting to enabled / 30 minutes / Desktop folder.
    - `backup_dir` — resolves the configured backup folder for creating backups.
    - `status_info` — aggregates config + total count + latest backup for the UI.
    - `spawn_auto_backup(handle)` — a background thread that re-reads the config every ~30s (so settings changes apply without a restart), sleeps the configured interval, and creates an `Auto_Backup_*.zip`. Single-tick failures are logged and the loop continues so it can never silently stop future backups.
  - `models/backup_config.rs`: `BackupConfig`, `UpdateBackupConfigInput`, `BackupStatusInfo`.
  - `repositories/backup_repository.rs`: added `latest()`.
  - New commands registered: `get_backup_config`, `update_backup_config`, `get_backup_status`. `create_backup` (manual) and `restore_backup` now target the configured Desktop folder.
  - Scheduled from `lib.rs` `.setup` (after `app.manage(db)`); the exit-time backup also writes `Auto_Backup_<ts>.zip` to `Desktop\Software Backup\` so an unexpected close still protects data.

- **Reliability**
  - Automatic backups use the same consistent, non-blocking SQLite snapshot as before; the scheduler tolerates failures per tick and recovers immediately.
  - Restore always writes an emergency safety backup first and never requires an app restart.
  - Both dev and the packaged EXE resolve the Desktop folder via `USERPROFILE`.

- **Frontend**
  - `types/backup.ts`: `BackupConfig`, `UpdateBackupConfigInput`, `BackupStatusInfo`.
  - `services/backupService.ts`: `getBackupConfig`, `updateBackupConfig`, `getBackupStatus`.
  - `pages/BackupManagerPage.tsx`: new "Automatic Backup" card (enable toggle + frequency select + backup folder path + Save), header shows the last-backup date/time, "Create Backup Now" produces a `Manual_Backup_*.zip`, list/verify/restore/delete operate on the recorded `.zip` backups.

- **Tests** — backup tests updated for the `.zip` format (auto prefix, manual prefix, restore round-trip, corrupted/truncated archive rejected, delete). Full suite: `cargo test --lib` (112 passed), `cargo build`, `npm run build` all green.

- **Permissions** (`backup.*`) remain documented but not hard-enforced; restore stays gated by the login session as elsewhere in the app.

---

# 30. Implementation Status (v3) — Restore from File Picker + Dynamic Frequency

Implemented (v3), closing the "no way to restore from the Desktop backup files" gap and making the schedule configurable.

- **Restore Backup via native file picker**
  - New `tauri-plugin-dialog` dependency (registered in `lib.rs`, uses the OS-native `rfd` dialog on Windows).
  - New backend command `pick_backup_file` — opens a file dialog pre-pointed at `Desktop\Software Backup`, filtered to `.zip`, and returns the selected path (or `null` if cancelled).
  - New backend command `restore_backup_from_path` — accepts an arbitrary `.zip`/`.db` path, runs `validate_archive` (checks the file exists, is a readable archive, contains the `business_management.db` snapshot, and passes `PRAGMA integrity_check`), then performs the normal safe restore (emergency `pre_restore_*.db` safety copy first). The restored archive is recorded into the `backups` table so it appears in history, and a `database-restored` event is emitted for the UI to refresh.
  - Frontend: a new **Restore Backup** button (in the Backup Manager header) opens the picker, shows the confirmation modal, and restores on [Restore]. The existing per-row Restore button in the history still works for DB-recorded backups.
  - Safety confirmation shows "Current data will be replaced... Do you want to continue?" with [Cancel] / [Restore].

- **Dynamic backup frequency**
  - New `backup_frequency` setting key with presets: **Every time**, **Every 10 minutes**, **Every 30 minutes**, **Every 1 hour**, **Every 3 hours**, and **Custom interval** (free-form minutes).
  - "Every time" = an automatic backup at every app launch plus the existing on-close backup (event-driven; the scheduler idles after the startup backup). Numeric/custom presets run on that interval.
  - `BackupConfig`/`UpdateBackupConfigInput` expose `backup_frequency`; `get_config`/`update_config` persist it; the scheduler reads it each cycle so changes apply without restart (min 1 min / max 24 h).

- **Backup History** — the Backup Manager table shows backup name, type (Automatic/Manual derived from the filename prefix), date & time, size, status, and a Restore button for every recorded backup (covers both auto-generated and manually created `.zip` files).

- **Reliability fix** — temp snapshot/restore/validation files are now uniquely named (pid + atomic counter) so a manual backup and an automatic backup running in the same second can never collide on the same temp path (this also removed intermittent parallel-test flakiness).

- **Tests** — updated backup tests (valid auto/manual prefixes, restore round-trip, corrupted archive rejected) plus `validate_archive`. Full suite `cargo test --lib` (112 passed), `cargo build`, and `npm run build` all green.

- **Dev + Production** — the file dialog pre-focuses the Desktop path resolved from `USERPROFILE`, so both the dev binary and the packaged EXE work identically.
