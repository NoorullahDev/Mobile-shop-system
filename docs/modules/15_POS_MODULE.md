# Point of Sale (POS) Module Documentation

## 1. Purpose

The POS module ("New Sale", route `/sales/new`) is the point-of-sale interface for the
mobile phone shop. It lets staff build a multi-item order from two distinct product
categories (Mobile Phones and Accessories), apply a discount, choose a payment method,
optionally record a customer, complete the sale (which reduces stock and stores the sale
history), and print a receipt.

## 2. Module Overview

Main workflow:

```
Choose Product Type (Mobile Phones / Accessories)
    ↓
Browse type-specific product grid → tap to add to cart
    ↓
Select customer (existing walk-in / inline-create new)
    ↓
Set discount, payment method, amount tendered
    ↓
Complete Sale → stock reduced + sale history stored
    ↓
Print Receipt
```

## 3. Product Type Selection

The POS page splits inventory into two product types via a toggle tab at the top of the
product panel:

- **Mobile Phones** (`category === "phone"`) — green/blue phone cards.
- **Accessories** (`category === "accessory"`) — tinted cards with accessory type.

The toggle filters the product grid (`typeProducts`) and drives the search placeholder.
The product count badges show how many of each type are currently in stock.

## 4. Type-Specific Product Cards

Product cards render fields appropriate to their category:

| Field | Mobile Phone | Accessory |
|-------|--------------|-----------|
| Icon container | Blue (`#EEF2FF`) | Green (`#F0FDF4`) |
| Subtitle line | `Storage · RAM · Color` | `Accessory type · "for <model>" · Color` |
| Extra badge | IMEI badge (if an IMEI is set) | — |

Both show brand + model, sale price (`formatMoneyCompact`), and cart/stock status, and a
plus/check button that adds the item to the cart.

## 5. Customer Selection & Inline Creation

- A **Customer** dropdown lists existing members plus a "Walk-in Customer" option.
- A **"+ New"** button (`UserPlus`) opens the **New Customer** modal (`NewCustomerForm`):
  name (required), phone, email, address. On save it calls `memberService.createMember`,
  refreshes the member store, and auto-selects the newly created customer for the sale.

## 6. Cart, Discount & Payment

- **Cart**: multi-line, each with product name, editable quantity (+/–), unit price (for
  phones with an IMEI, the specific IMEI unit can be chosen), line total, and remove.
- **Subtotal** auto-accumulates from line totals; **discount** (Rs) is subtracted to compute
  the **Total Due**.
- **Payment method**: Cash / Bank Transfer / Card / Other (`PAYMENT_METHODS`).
- For non-cash, an optional **amount tendered** can be entered; if less than total, the
  remainder is shown as "Balance due (On credit)". For cash, change to return is shown.

## 7. Sale Completion (Backend)

`create` in `sale_service.rs` (existing, unchanged for this slice):

- Validates items non-empty, discount ≥ 0, stock for each line, unit price, and IMEI availability.
- Computes subtotal, applies discount, requires discount ≤ subtotal.
- Applies all insertions + stock decrements (+ IMEI mark-sold) in a single transaction.
- Stores receipt no, member, totals, paid amount, payment method, notes, actor.
- Records an activity-log entry (`sale / create`) and returns the sale with items.

This satisfies the requirement that **sales history** captures customer, purchased products,
discount, total amount, payment method, and date/time, and that stock is reduced on completion.

---

## Implementation Status

Implemented:

- **Backend**: `sale_service::create` / `sale_repository` / `create_sale` command — multi-item
  cart, IMEI, member, discount, stock reduction, retail history. No backend changes were needed.
- **Frontend — Product type toggle**: Mobile Phones / Accessories tabs with per-type counts,
  filtering, and type-specific search placeholder.
- **Frontend — Type-specific cards**: phones show storage/RAM/color/IMEI in blue; accessories
  show accessory type/for-model/color in green.
- **Frontend — Inline customer creation**: "+ New" customer button → `NewCustomerForm` modal →
  creates via `memberService.createMember`, refreshes member store, auto-selects new customer.
- Build verified: `npm run build` green (TS + Vite).

**Post-split (phones vs accessories tables)**: POS was updated for the physical two-table split.
It now shows one unified in-stock product list built from the `products` view
(`item_type`/`item_id`) in `useInventoryStore`, with Mobile Phones / Accessories tabs filtering by
`item_type`. Cart lines carry `item_type` + `item_id`; IMEI selection is available only for phone
lines (via `mobileService.listPhoneImeis`). Checkout emits `SaleItemInput[]` with
`item_type`/`item_id` which maps to `sale_items.phone_id`/`accessory_id` in `sale_service::create`.
Backend sale_service remains transactional and unchanged in behaviour.

Not yet implemented / possible enhancements:

- Server-side receipt PDF / printable receipt customization.
- Barcode scanner integration for adding products by SKU/IMEI.
- Layaway / instalment plans per sale.
- Returning/voiding a sale from the POS directly (sales return flow).
