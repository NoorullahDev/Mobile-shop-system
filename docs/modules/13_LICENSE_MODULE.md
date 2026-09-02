# License Module Documentation

## 1. Purpose

The License module manages software licensing and customer access.

It controls:

- License generation
- License activation
- License validation
- Expiry management
- Customer information
- Offline verification
- License status


The goal is to protect the software while providing a smooth customer experience.


---

# 2. Module Overview

The application requires a valid license before full access.


Application startup flow:



Application Starts

↓

License Checker Runs

↓

Find Local License

↓

Validate License

↓

Check Expiry

↓

Check Status

↓

Open Application



---

# 3. License Types


The system should support different license models.


## Trial License


Purpose:

Allow users to test the software.


Example:



Duration:

30 Days



Restrictions:


- Limited features
- No production usage


---

## Permanent License


Purpose:

One-time purchase license.


Example:



Lifetime Access



---

## Subscription License


Future support:



Monthly

Yearly



---

# 4. License Information


Each license should contain:



License ID

Customer Name

Business Name

Product Name

License Type

Activation Date

Expiry Date

Status

Created Date



---

# 5. License Activation


## Offline Activation Flow


Because the software works offline:



Customer Provides License Key

↓

Application Reads Key

↓

Validate Signature

↓

Save License Locally

↓

Activate Software



No internet connection should be required.


---

# 6. License Key System


License keys should not contain plain information.


Example:


Bad:



CUSTOMER123-2026



Good:



Encrypted Signed Token



The application should verify authenticity using cryptographic methods.


---

# 7. Device Binding


Optional security feature.


License can be linked with:



Machine ID

Hardware Fingerprint

Installation ID



Purpose:


Prevent unauthorized copying.


---

# 8. License Validation


Validation checks:


## Status


Possible values:



Active

Expired

Suspended

Invalid



---

## Expiry


Example:



Current Date

↓

Compare Expiry Date

↓

Allow / Block



---

## Integrity


Check:



License Signature

↓

Valid / Invalid



---

# 9. License Management (Admin Side)


Admin should have a separate license management system.


Features:



Create License

View Licenses

Deactivate License

Extend Expiry

Regenerate License



---

# 10. License Dashboard


Display:



Total Licenses

Active Licenses

Expired Licenses

Upcoming Expiry



---

# 11. Customer License Information


Admin can view:



Customer Name

Business Name

License Status

Activation Date

Expiry Date

Machine Information



---

# 12. Frontend Requirements


Customer application:


Required screens:



LicenseActivationPage

LicenseStatusPage

LicenseExpiredPage



Admin panel:



LicenseManagementPage

LicenseDetailsPage



Components:



LicenseInput

StatusCard

ActivationDialog

LicenseTable



---

# 13. UI Requirements


License activation page should be simple and professional.


Example:



Software Logo

Enter License Key

[________________]

[ Activate ]



---

# 14. Backend Architecture


Application side:



commands/

license_commands.rs

services/

license_service.rs

validation_service.rs

repositories/

license_repository.rs

models/

license.rs



---

# 15. License Service Responsibilities


Handles:


- License reading
- Validation
- Activation
- Expiry checking
- Status management


---

# 16. Cryptography Requirements


License verification should use:


Example:



Private Key

↓

Generate License

Public Key

↓

Verify License



The private key should never exist inside the customer application.


---

# 17. Database Requirements


## Licenses Table



licenses



Fields:



id

license_key

customer_name

business_name

license_type

status

activation_date

expiry_date

machine_id

created_at



---

# 18. Local License Storage


The activated license should be stored securely.


Example:



Application Data Folder

Encrypted License File



Never store:



Plain License Key



---

# 19. Business Rules


## Rule 1

Application cannot run without valid license.


---

## Rule 2

Expired license shows renewal message.


---

## Rule 3

License validation happens during startup.


---

## Rule 4

License changes must create activity logs.


---

# 20. License Expiry Handling


Before expiry:


Example:



License expires in 7 days



Show notification.


After expiry:



License expired.

Please renew your license.



---

# 21. Permissions


Required permissions:



license.view

license.create

license.update

license.deactivate



Only authorized administrators can manage licenses.


---

# 22. Error Handling


Invalid license:



Invalid license key.



Expired license:



Your license has expired.



Corrupted license:



License verification failed.



---

# 23. Testing Requirements


## Backend Tests


### Valid License


Input:



Correct License Key



Expected:



Activation successful



---

### Invalid License


Expected:



Activation rejected



---

### Expired License


Expected:



Access blocked



---

### Machine Validation


Expected:



Unauthorized device rejected



---

# Frontend Tests


Test:


✓ License input

✓ Activation flow

✓ Error messages

✓ Expiry screen

✓ Status display


---

# 24. Security Requirements


Protect against:


- License copying
- Key modification
- Reverse engineering attempts
- Unauthorized activation


Required:


- Digital signatures
- Encryption
- Secure storage
- Validation checks


---

# 25. Performance Requirements


License checking should:


- Complete quickly
- Not delay application startup
- Work offline


---

# 26. Future Improvements


Possible features:


- Online license portal

- Automatic renewal

- Cloud license management

- Customer dashboard

- Remote activation control


---

# 27. Completion Checklist


Before completing License module:


✓ License generation completed

✓ Activation system completed

✓ Offline validation completed

✓ Expiry handling completed

✓ Admin management completed

✓ Security implemented

✓ Tests completed

✓ Documentation updated

---

# 28. Implementation Status

Implemented (v1):

- **Backend (core crypto — real, not frontend-only)**
  - `services/license_service.rs`: HMAC-signed `MSP-` license keys (`generate_key`/`parse_key`), hardware binding to a machine Hardware ID, `activate`/`deactivate`/`status` with `activated`, `expired`, `activated_until`, `remaining_days` recomputed from the saved activation timestamp.
  - `repositories/license_repository.rs`: license stored in the `settings` table keys `license_key`, `license_customer`, `license_granted_days`, `license_activated_at`.
  - Commands registered in `lib.rs`: `get_license_status`, `activate_license`, `deactivate_license`. A key is accepted only if its signature verifies AND the Hardware ID matches this machine AND the license has not expired.
  - 6+ unit tests (valid / invalid / expired / machine-mismatch / activate / deactivate).

- **Keygen tool (Admin / Vendor)** — `src-tauri/src/bin/keygen.rs`
  - Generates a hardware-bound key from a customer's Hardware ID.
  - Interactive presets: **7 days, 30 days, 6 months (180), 1 year (365), Custom** ("Select (1-5):" prompt), plus a non-interactive one-shot mode: `cargo run --bin keygen -- "<Customer>" <Days> "<HardwareID>"`.
  - Re-exports from `lib.rs`: `generate_key` and `get_hardware_id`.
  - Note: Windows Application Control policy may block running the freshly built exe directly; run the copy from `%LOCALAPPDATA%\Temp\opencode\keygen.exe` if needed.

- **Frontend — License Gate (`components/LicenseGate.tsx` + `App.tsx`)**
  - On fresh install (not activated) the ERP and login are blocked and a full-screen **Activation** screen is shown: displays the machine's **Hardware ID** (with copy button), a license-key field, and an **Activate License** button that calls the real `activate_license` backend command.
  - When expired a full-screen **License Expired** screen blocks access, shows the previous expiry date, and offers **Renew License**.
  - `App.tsx` loads license status at startup; every ERP route redirects to `/activation` while `status.activated` is false; `/login` and `/license` remain reachable for status/deactivation.
  - `pages/LicensePage.tsx` (in-app, at System → License) shows Hardware ID, License Status (Active/Expired), Activation Date, Expiry Date, Days Remaining, and a Renew button; it now reflects the same backend status used by the gate.

- **Flow (as in product spec)**:
  1. Fresh install → Activation screen shows Hardware ID.
  2. Customer sends HW ID to Admin/Owner.
  3. Admin runs keygen, picks a duration preset, pastes the HW ID, gets a key.
  4. Customer pastes the key → entered on the Activation screen → verified (signature + HW ID + expiry) → ERP unlocks.
  5. Expiry: license rejected, app blocked, Renew option shown; entering a new key updates expiry/remaining days automatically.

- **Verified**: `cargo build` (warnings pre-existing), `cargo test --lib` (108 passed, incl. license tests), `npm run build` (tsc + vite) green. No existing ERP features or data touched.

- **Not yet implemented** (from spec "Future Improvements"): online license portal, automatic renewal, cloud license management, customer dashboard, remote activation control.
