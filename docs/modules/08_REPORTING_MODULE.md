# Reporting Module Documentation

## 1. Purpose

The Reporting module provides business insights by converting application data into meaningful reports.

It allows users to:

- View business performance
- Generate financial reports
- Create custom reports
- Apply filters
- Export reports
- Print reports


The module should be flexible enough to support future business requirements.


---

# 2. Module Overview

The Reporting module collects data from different modules:



Members

Payments

Expenses

Transactions

Activity Logs

↓

Report Engine

↓

Generated Report

↓

PDF / Print / Export



---

# 3. Report Types


The system should support:


## Financial Reports


Examples:



Income Report

Expense Report

Profit/Loss Report

Transaction Report



---

## Member Reports


Examples:



Total Members

New Members

Member Activity

Payment History



---

## Activity Reports


Examples:



User Actions

Login History

System Changes



---

# 4. Default Report Templates


The system should provide ready-made templates.


## Weekly Report


Contains:



Weekly Income

Weekly Expenses

New Members

Transactions



---

## Monthly Report


Contains:



Monthly Revenue

Monthly Expenses

Balance

Growth Comparison



---

## Yearly Report


Contains:



Annual Summary

Financial Trends

Business Growth



---

# 5. Custom Report Builder


Users should be able to create custom reports.


Workflow:



Select Data Source

↓

Choose Fields

↓

Apply Filters

↓

Select Template

↓

Generate Report



---

# 6. Data Sources


Available sources:



Members

Payments

Expenses

Transactions

Users

Activity Logs



---

# 7. Report Filters


Reports should support:


## Date Filters



Today

Yesterday

This Week

This Month

This Year

Custom Range



---

## Data Filters


Examples:


Members:



Active Members

Inactive Members



Payments:



Payment Method

Payment Status

Amount Range



Expenses:



Category

Amount Range



---

# 8. Report Templates


Users can select templates.


Example:



Template 1

Professional Summary

Template 2

Detailed Table

Template 3

Financial Statement



---

# 9. Report Preview


Before exporting:


Show preview:



Report Title

Date Range

Summary Cards

Tables

Charts



---

# 10. Export System


Supported formats:


## PDF


Used for:

- Printing
- Sharing
- Official records


---

## CSV / Excel


Used for:

- Data analysis
- External processing


---

# 11. Printing System


Reports should support:


- A4 printing
- Professional formatting
- Header/footer
- Business logo


Example:



Business Name

Report Title

Generated Date

Data Table

Footer



---

# 12. Frontend Requirements


Required pages:



ReportsPage

ReportBuilder

ReportPreview

TemplateManager



Components:



ReportCard

FilterPanel

DataSelector

TemplateSelector

ExportButton

PrintButton



---

# 13. UI Requirements


The reporting interface should be professional.


Must include:


✓ Report cards

✓ Filter sidebar

✓ Table preview

✓ Charts

✓ Export buttons

✓ Print button


---

# 14. Report Table Requirements


Tables should support:


✓ Sorting

✓ Searching

✓ Pagination

✓ Column selection

✓ Export


The design should feel similar to professional Excel-style tables.


---

# 15. Backend Architecture


Structure:



commands/

report_commands.rs

services/

report_service.rs

template_service.rs

repositories/

report_repository.rs

models/

report.rs



---

# 16. Report Service Responsibilities


Handles:


- Data collection
- Report generation logic
- Filtering
- Template processing
- Export preparation


---

# 17. Report Repository Responsibilities


Handles:


- Fetching required data
- Optimized database queries
- Aggregations


---

# 18. Database Requirements


## Reports Table



reports



Fields:



id

name

type

template_id

created_by

created_at



---

## Report Templates Table



report_templates



Fields:



id

name

layout

configuration

created_at



---

# 19. Business Rules


## Rule 1

Reports must respect user permissions.


Example:


Staff cannot see financial reports without permission.


---

## Rule 2

Generated reports should store creation information.


---

## Rule 3

Report calculations must use original database data.


---

# 20. Permission Requirements


Required permissions:



reports.view

reports.create

reports.export

reports.print

reports.manage_templates



---

# 21. Error Handling


No data found:



No records available for selected filters.



Export failure:



Unable to generate report.
Please try again.



---

# 22. Testing Requirements


## Backend Tests


### Monthly Report


Input:



January Data



Expected:



Correct monthly totals



---

### Filter Testing


Test:



Date filter

Category filter

Amount filter



---

### Export Testing


Expected:



File generated successfully



---

# Frontend Tests


Test:


✓ Report loading

✓ Filters

✓ Preview

✓ Export buttons

✓ Print functionality

✓ Empty states


---

# 23. Performance Requirements


Reports must handle:


- Large transaction data
- Multiple filters
- Complex calculations


Required:


- Indexed queries
- Pagination
- Data aggregation


---

# 24. Security Requirements


Reports must protect:


- Financial information
- User activity data


Required:


- Permission validation
- Audit logging


---

# 25. Future Improvements


Possible features:


- AI business insights

Example:


"Expenses increased 20% this month."


- Scheduled automatic reports

- Email reports

- Dashboard widgets from reports

- Advanced analytics


---

# 26. Completion Checklist


Before completing Reporting module:


✓ Default reports created

✓ Custom builder implemented

✓ Filters implemented

✓ Templates implemented

✓ PDF export completed

✓ Printing completed

✓ Permissions added

✓ Tests completed

✓ Documentation updated

# 29. Implementation Status

Implemented (v1):

- **Backend**: existing reporting endpoints (`get_period_summary`, `get_sales_series`, `get_payment_breakdown`, `get_top_sellers`) unchanged; this slice was purely frontend.
- **Frontend � Print**: `components/PrintReport.tsx` renders a clean, printable report (KPIs, sales-by-day, payment mix, top sellers, receivables/payables, expenses by category & transactions). `ReportsPage` adds a **Print** action that toggles `body.printing` and calls `window.print()`; `index.css` includes an `@media print` stylesheet that shows only the print report and hides the app chrome.
- **Frontend � Export CSV**: `ReportsPage` adds an **Export CSV** action that serialises the currently loaded report data (KPIs, sales by day, payment mix, top sellers, expenses by category + transactions) into a `report_<from>_to_<to>.csv` download on the client (no backend involved).

- **Not yet implemented**: server-side PDF generation, custom report template persistence, scheduling/emailing reports, chart-image embedding in exports. CSV is plain-data (no visual charts).

**Post-split (phones vs accessories tables)**: `get_top_sellers` was rewritten to UNION over the
new `phones` and `accessories` tables, and `TopSeller` now carries `item_type`/`item_id` instead of
`inventory_id`. `dashboard_summary` sums `products_total` and `low_stock_count` across both tables.
Frontend `ReportsPage` and `PrintReport` were updated to read `item_id` (and `item_type`) for the
Top Sellers section. All reporting unit tests pass (98 total).


**Reports vs Profit & Loss separation (v3)**: Reports and Profit & Loss were previously combined
into one page. They are now two separate pages with their own routes and UI.

- **Reports** (`/reports`, `ReportsPage`): Sales reports (revenue KPIs, daily sales trend, payment
  method mix), Product reports (top sellers with item_type badge), Inventory reports (phone &
  accessory SKUs, units, stock value, low/out-of-stock, stock tables), Customer reports (customer
  balances/credit), and Supplier reports (supplier balances/payables). Keeps date filter + Print +
  Export CSV.
- **Profit & Loss** (`/reports/profit`, `ProfitLossPage`): Total Revenue, Cost of Goods Sold (COGS,
  from item cost_price x quantity sold), Total Expenses, Gross Profit (Revenue - COGS), Net Profit
  (Gross Profit - Expenses), plus a detailed monthly profit analysis (chart + breakdown table) and
  a printable statement. New backend endpoint `get_profit_loss` and model `ProfitLoss`
  (repository `profit_loss_summary` + `monthly_profit_loss`).
- Menu: Finance & Reports = Expenses | Reports | Profit & Loss (single Reports item).
