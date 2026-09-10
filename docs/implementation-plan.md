# Receipt & Thermal Printing System - Detailed Implementation Plan

## Project
Mobile Shop Management Software

## Scope
Rebuild the removed receipt printing flow and add a professional Receipt Settings system.

This plan must be applied only after inspecting the existing codebase.

# Phase 1 - Codebase Discovery

Before writing implementation code, inspect and document:

1. Application framework
   - Confirm Tauri/Electron/current desktop runtime.
2. Existing Sales flow
   - Sale completion
   - Invoice number creation
   - Sale items
   - Customer data
   - Payment data
3. Existing receipt components
   - Check whether any old receipt preview still exists.
4. Existing print code
   - Search for `window.print`
   - print plugins
   - native commands
   - print window helpers
   - PDF generation
5. Existing Settings architecture
   - Database settings table
   - key/value settings
   - settings API
   - frontend settings store
6. Business profile data
   - Shop name
   - Logo
   - Address
   - Phone
   - Email
7. Production build configuration
   - Verify any Tauri/Electron permissions/plugins needed for printer access.

Do not create a new parallel architecture until the existing one has been reviewed.

# Phase 2 - Define Receipt Architecture

Use three logical layers:

## A. Receipt Data
Create a normalized receipt view model from existing sale data.

Responsibilities:
- Business details
- Invoice metadata
- Customer
- Sale items
- IMEI/serial information
- Totals
- Payment
- Footer

The renderer should not query random database tables directly.

## B. Receipt Settings
Create/reuse persistent receipt settings.

Settings control:
- Paper width
- Font size
- Printer
- Visibility toggles
- Footer text

Use the existing Settings persistence mechanism wherever possible.

## C. Receipt Renderer / Printer
Use the same receipt data + settings for:
- Live preview
- Physical thermal print

Avoid maintaining two different receipt templates.

# Phase 3 - Receipt Settings UI

Add:

Settings → Receipt

Suggested layout:

Left side:
- Receipt controls

Right side:
- Live Preview

Controls:

### Print
- Printer / Destination
- Paper Width: 58mm / 80mm
- Font Size

### Business Information
- Shop Name
- Logo
- Tagline
- Address
- Phone
- Email

### Receipt Details
- Receipt title
- Invoice number
- Date/time
- Customer information

### Item Details
- Product details
- IMEI / serial where applicable

### Payment Details
- Subtotal
- Discount
- Tax
- Total
- Paid
- Balance
- Payment method

### Footer
- Show Footer
- Footer Text

Add:
- Save Changes

Requirements:
- Changes update preview immediately.
- Saving persists settings.
- Use existing project design system.
- No text overflow.
- Responsive desktop layout.

# Phase 4 - Receipt Preview Component

Build or refactor a reusable receipt component.

Inputs:
- receiptData
- receiptSettings
- previewMode / printMode

Preview mode:
- Readable on laptop
- Centered
- Vertical scroll for long receipts
- 58mm/80mm visual proportions
- No tiny unreadable scaling

Print mode:
- Real physical dimensions
- No surrounding app UI

Receipt sections:
1. Header
2. Receipt title
3. Invoice metadata
4. Items
5. Totals/payment
6. Footer
7. Developer branding

Empty optional fields should not leave blank rows.

# Phase 5 - Restore Print Receipt Action

Restore the Print Receipt button/action in the correct existing sales/receipt flow.

Do not add duplicate buttons in multiple unrelated places.

Expected flow:

Sale / Sales History
→ Open Receipt Preview
→ Print Receipt
→ Load saved printer settings
→ Generate print-only receipt
→ Send one job to thermal printer

# Phase 6 - Native Thermal Printing Integration

The old implementation failed with blank pages/A4 output.

Therefore:

1. Identify why the old print flow failed.
2. Do not restore the same broken implementation.
3. Use the correct printing API for the actual desktop framework.

For Tauri:
- Inspect currently supported/installed print plugin or native command approach.
- Use the existing approved plugin/integration if available.
- Do not invent an unsupported API.

For Electron:
- Use the existing main/preload IPC architecture and native print API.

Printing requirements:
- 58mm and 80mm
- one receipt per click
- no blank first page
- no A4
- no tiny scaled receipt
- no application UI
- no browser header/footer
- no URL/page number
- content-driven height
- minimal margins

# Phase 7 - Thermal CSS / Print Layout

Create dedicated thermal print styles.

Do not reuse ordinary application page styles blindly.

Check and remove print-breaking rules such as:
- fixed A4 width/height
- `100vh`
- large `min-height`
- centered A4 containers
- unnecessary body padding
- oversized margins
- fixed receipt height
- page-break rules that generate empty pages

Use width-specific layout rules for:
- 58mm
- 80mm

Long product names must wrap correctly.
Amounts should remain aligned.

# Phase 8 - Dynamic Height Strategy

This is critical.

The old system produced extra blank pages/paper.

The final implementation must make receipt length follow content.

Before choosing an implementation, inspect what the current printing API supports.

If the native print API supports custom page dimensions:
- calculate/use the appropriate receipt dimensions.

If physical roll printers naturally cut/advance after content:
- avoid forcing A4/fixed-height document dimensions.

Do not fake the fix by merely scaling a receipt inside a large page.

# Phase 9 - Data Mapping

Map existing sales data into receipt output.

Must support:

## Sale
- Invoice number
- Date/time
- Customer
- Payment method
- Amount paid
- Balance due

## Items
- Product
- Brand/model
- Variant
- Quantity
- Unit price
- Line total

## Phones
- IMEI
- Serial number if available

## Accessories
- Relevant details only

Do not hard-code test products.

# Phase 10 - Database / Settings Migration

Before adding a new table, inspect existing settings persistence.

Preferred order:
1. Reuse existing settings storage.
2. Extend existing receipt/settings entity.
3. Only create a new ReceiptSettings table if the architecture truly needs it.

If migration is required:
- Make migration safe for existing production databases.
- Provide defaults.
- Do not wipe existing user data.

Suggested defaults:
- Paper width: 80mm
- Font size: 11
- Show Shop Name: true
- Show Logo: true if logo exists
- Show Address: true
- Show Phone: true
- Show Email: true
- Show Invoice Number: true
- Show Date/Time: true
- Show Customer: true
- Show Payment Details: true
- Show Footer: true

# Phase 11 - Printer Selection

If the desktop framework supports printer enumeration:
- Retrieve installed printers.
- Show them in Receipt Settings.
- Include System Default.
- Persist selected printer identifier/name.

If printer enumeration is not supported by the current stack:
- document the limitation,
- use the safest supported native flow,
- do not create fake printer names.

# Phase 12 - Error Handling

Handle:
- printer unavailable
- saved printer removed
- print command failure
- receipt data missing
- logo missing
- settings load failure

User-facing errors should be simple and useful.

Do not silently fail.

# Phase 13 - Testing

## Settings Tests
Verify:
- Save/load 58mm
- Save/load 80mm
- Font size persistence
- Visibility toggles
- Footer text
- Printer preference
- App restart persistence

## Preview Tests
Verify:
- 58mm preview
- 80mm preview
- long receipt scroll
- long names
- missing optional fields
- logo on/off

## Receipt Data Tests
Verify:
- phone sale
- phone with IMEI
- phone with serial
- accessory sale
- mixed sale
- discount
- partial payment
- balance due
- walk-in customer

## Print Tests
Verify using actual thermal printer where available:

### 58mm
- one item
- many items

### 80mm
- one item
- many items

Must confirm:
- one print job
- no blank page
- no A4
- no tiny receipt
- no extra top page
- no unnecessary bottom paper
- readable font
- correct width
- correct totals

## Production Tests
Test:
- Development
- Production packaged EXE
- Fresh install
- Existing database upgrade

# Phase 14 - Regression Audit

After implementation, audit affected code.

Check:
- Sales flow still works
- Inventory is unchanged
- Invoice numbers unchanged
- Customer/payment calculations unchanged
- Settings do not break other modules
- Production build succeeds
- No TypeScript errors
- No broken imports
- No dead print code accidentally still running
- No duplicate print handler
- No double print job
- No duplicate receipt system

Fix all receipt/printing-related bugs before declaring completion.

# Phase 15 - Definition of Done

The task is complete only when:

1. Settings → Receipt exists.
2. Owner can configure the receipt dynamically.
3. Live Preview works.
4. 58mm works.
5. 80mm works.
6. Print Receipt action is restored in the correct flow.
7. Physical thermal print does not generate blank pages.
8. Receipt is not printed as A4.
9. Receipt is not tiny/scaled incorrectly.
10. Receipt length follows content correctly.
11. Settings persist after restart.
12. Production EXE works.
13. No unrelated project functionality is changed.

# OpenCode Instruction

Read:
- `thermal-printer.md`
- `receipt-settings.md`
- `implementation-plan.md`

Then inspect the actual codebase.

Before changing code, compare this plan against the existing architecture and report:

1. Current relevant files
2. Existing printing approach
3. Existing settings approach
4. Database changes actually required
5. Exact files you plan to modify
6. Risks
7. Final implementation sequence

Do not blindly replace working project architecture.

Do not change unrelated functionality.
