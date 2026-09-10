# Receipt Settings and Receipt Layout Requirements

## Project
Mobile Shop Management Software

## Purpose
Add a professional, dynamic Receipt Settings system to the existing Settings module and provide a live receipt preview similar to a real POS application.

The owner/client must be able to customize the receipt without editing code.

## 1. Settings Location
Add:

Settings → Receipt

Reuse the existing Settings architecture.

## 2. Receipt Print Settings
The Receipt Settings page should include:

### Destination
Allow printer/destination selection if supported by the current application architecture.

Examples:
- Selected Thermal Printer
- System Default Printer
- Print Window / Preview if needed

Do not force browser/A4 printing.

## 3. Paper Width
Allow:
- 80mm
- 58mm

The selected width must update both Live Preview and Actual Print Output.

## 4. Font Size
Allow owner/admin to adjust receipt font size.

Suggested safe range:
- 9
- 10
- 11
- 12
- 13
- 14

The font-size setting must update the live preview immediately.

## 5. Receipt Information Visibility
Every important receipt section should be configurable using checkboxes/toggles.

### Business Information
Allow show/hide:
- Shop Name
- Shop Logo
- Shop Tagline if available
- Address
- Phone
- Email

### Receipt Information
Allow show/hide:
- Receipt / Invoice Title
- Invoice Number
- Date and Time
- Customer Name
- Customer Phone if available

### Item Information
Allow show/hide where appropriate:
- Product Name
- Variant / Specs
- Quantity
- Unit Price
- Line Total
- IMEI / Serial Number for mobile phones

### Payment Information
Allow show/hide:
- Subtotal
- Discount
- Tax
- Total
- Amount Paid
- Remaining / Balance Due
- Payment Method

### Footer
Allow show/hide:
- Footer section
- Custom Footer Text
- Developer/Software Provider information

## 6. Footer Text
Provide an editable Footer Text field.

Example:
Thank you for shopping with us!

The client/shop owner should be able to change this text without code changes.

## 7. Developer Footer
Support:

Software developed by EagleNest Creations
0346-4451505

This should be displayed professionally and should not overpower the shop's own branding.

## 8. Live Preview
A Live Preview must appear on the Receipt Settings page.

The preview should update immediately when the user changes:
- Paper width
- Font size
- Show/hide options
- Footer text
- Logo visibility
- Business information

The preview must be readable on screen.

Important:
The on-screen preview can be scaled for readability, but the actual thermal print must use the real physical 58mm/80mm dimensions.

## 9. Professional Mobile Shop Receipt Layout

```text
            [LOGO]

      EagleNest Mobile Shop
          Shop Tagline
         Address / Phone

--------------------------------
          SALES RECEIPT
--------------------------------

Invoice No        INV-000001
Date & Time       10 Sep 2026
Customer          Walk-in Customer

--------------------------------
ITEMS
--------------------------------

iPhone 15 Pro Max 256GB
IMEI: 35XXXXXXXXXXXXX
1 × Rs. 300,000        Rs. 300,000

Apple 20W Charger
2 × Rs. 3,000            Rs. 6,000

--------------------------------
Subtotal               Rs. 306,000
Discount                 Rs. 6,000
TOTAL                  Rs. 300,000
Amount Paid            Rs. 300,000
Payment Method               Cash
--------------------------------

      Thank you for shopping with us!

        Software developed by
         EagleNest Creations
           0346-4451505
```

## 10. Mobile Phone Specific Data
For mobile phone sales, the receipt should support:
- Brand
- Model
- Variant
- IMEI
- Serial Number, if available

Do not show empty fields.

## 11. Accessory Specific Data
For accessories, show only relevant information:
- Product name
- Brand
- Quantity
- Unit price
- Line total

Do not show IMEI unless that product supports identifier tracking.

## 12. Settings Persistence
Receipt settings must remain after:
- app restart
- logout/login
- production EXE restart

Reuse the existing settings/database architecture where possible.

## 13. Suggested Settings Data
The final schema should follow the project's existing architecture, but may include:
- paperWidth
- fontSize
- printerName / printerId
- showLogo
- showShopName
- showTagline
- showAddress
- showPhone
- showEmail
- showReceiptTitle
- showInvoiceNumber
- showDateTime
- showCustomer
- showItemDetails
- showPaymentDetails
- showFooter
- footerText
- createdAt
- updatedAt

Do not create duplicate settings tables if an existing generic settings system can store these values.

## 14. Save Changes
Provide a clear Save Changes action.

After save:
- Persist settings
- Update preview
- Use the same settings for future receipts

## 15. Final Rule
Everything must be dynamic and database/settings-driven.

Do not hard-code client-specific receipt behaviour into the UI.

Do not change unrelated project functionality.
