# Thermal Printer System Requirements

## Project
Mobile Shop Management Software

## Purpose
Rebuild the thermal receipt printing system for the Mobile Shop Management Software.

The old thermal print implementation was removed because it produced blank pages, tiny receipts, A4-style output, extra paper, or incorrect scaling on real thermal printers.

The new system must behave like a professional POS thermal printing system.

## 1. Supported Paper Sizes
- 58mm thermal paper
- 80mm thermal paper

The selected paper size must affect receipt preview, print output, printable width, font and spacing rules.

Do not use A4 as the receipt paper size.

## 2. Printing Workflow
Sale Completed
→ Generate Receipt Data
→ Load Saved Receipt Settings
→ Show Receipt Preview
→ User Clicks Print Receipt
→ Send Receipt to Selected Thermal Printer
→ Print One Correct Receipt

The system must not print a blank page before the receipt and must not shrink the receipt into a tiny area on a large page.

## 3. Thermal Printing Rules
The final printed receipt must have:
- Correct 58mm or 80mm width
- Dynamic height based on content
- No A4 page
- No browser headers or footers
- No URL or page numbers
- No large margins
- No unnecessary blank paper
- No extra blank first page
- No scaling that makes text unreadable

The paper should end shortly after the final receipt footer.

If a receipt has few items, it should be short.
If a receipt has many items, it should become longer automatically.

## 4. Direct Printing
First inspect the project and determine whether it is using Tauri, Electron, browser printing, a print plugin, or a native print command.

Do not rely only on `window.print()` if it causes A4/default browser printing.

Use the framework's supported native printing workflow where appropriate.

## 5. Printer Selection
The system should be able to:
- Detect installed printers when supported
- Show available printers
- Allow owner/admin to select a printer
- Save the selected printer
- Allow system default printer as an option

## 6. Paper Width Behaviour
### 58mm
Use compact spacing and typography. Content must remain readable and should not overflow.

### 80mm
Use slightly wider layout while preserving the same receipt structure.

Use one receipt engine with width-specific print styles.

## 7. Dynamic Height
Receipt height must follow the actual rendered receipt content.

Do not use:
- A4 height
- fixed large height
- `100vh`
- unnecessary `min-height`
- large bottom padding

The final print/PDF test output should end after the receipt footer.

## 8. Print Content
Only the receipt itself should be printed.

Do not print modal background, page navigation, buttons, sidebar, top bar, close button, or surrounding application UI.

## 9. Required Test Cases
### 58mm
- 1 item
- Multiple items
- Long product names
- Mobile phone with IMEI
- Accessory sale

### 80mm
- 1 item
- Multiple items
- Long product names

### Printer Behaviour
- No blank first page
- No A4
- No tiny receipt
- No extra bottom paper
- Correct scaling
- Correct width
- Dynamic height
- One click produces one receipt

### Builds
- Development
- Production EXE / packaged desktop build

## 10. Final Rule
Do not change unrelated functionality.

Only rebuild and stabilize the receipt printing layer and the settings required by it.

Before implementation, inspect the current codebase and identify the root cause of the previous blank-page/A4 issues.
