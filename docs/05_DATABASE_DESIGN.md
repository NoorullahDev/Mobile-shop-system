# Database Design Document

## 1. Purpose

This document defines the database architecture for the Mobile Shop System.

The database is designed for:

- Offline operation
- Data consistency
- Fast queries
- Easy backup
- Future scalability


Database Technology:

SQLite


---

# 2. Database Principles

The database must follow these rules:

## Rule 1: Migration Based Changes

Database changes must always be done through migrations.

Never manually modify production databases.


Example:


migrations/

001_create_users.sql

002_create_members.sql

003_add_payment_fields.sql



---

## Rule 2: Data Integrity

The database must enforce:

- Primary keys
- Foreign keys
- Unique constraints
- Validation rules


---

## Rule 3: Transaction Safety

Financial operations must use database transactions.

Examples:

- Receiving payments
- Updating balances
- Deleting transactions


---

# 3. Database Structure


Main Tables:



users

roles

members

payments

expenses

categories

report_templates

settings

activity_logs

suppliers

inventory

inventory_imei

sales

sale_items



---

# 4. Users Table


Purpose:

Store application users.


Table:


users



Fields:


| Field | Type | Description |
|-|-|-|
| id | INTEGER | Primary key |
| username | TEXT | Login username |
| password_hash | TEXT | Encrypted password |
| role_id | INTEGER | User role |
| status | TEXT | Active/Inactive |
| created_at | DATETIME | Creation date |
| updated_at | DATETIME | Last update |


Rules:

- Username must be unique
- Password must never be stored directly


---

# 5. Roles Table


Purpose:

Manage permissions.


Table:


roles



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| name | TEXT |
| permissions | TEXT |
| created_at | DATETIME |


Example roles:



Admin

Staff

Accountant



---

# 6. Members Table


Purpose:

Store customer/member information.


Table:


members



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| name | TEXT |
| phone | TEXT |
| email | TEXT |
| address | TEXT |
| image_path | TEXT |
| status | TEXT |
| notes | TEXT |
| created_at | DATETIME |
| updated_at | DATETIME |


Required:

- Name


Optional:

- Phone
- Email
- Address
- Image
- Notes


---

# 7. Payments Table


Purpose:

Store received payments.


Table:


payments



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| member_id | INTEGER |
| amount | REAL |
| payment_method | TEXT |
| reference | TEXT |
| notes | TEXT |
| payment_date | DATETIME |
| created_by | INTEGER |


Payment Methods:



Cash

Bank

Card

Other



---

# 8. Expenses Table


Purpose:

Track business expenses.


Table:


expenses



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| category_id | INTEGER |
| amount | REAL |
| description | TEXT |
| receipt_path | TEXT |
| expense_date | DATETIME |
| created_by | INTEGER |


---

# 9. Categories Table


Purpose:

Classify expenses.


Table:


categories



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| name | TEXT |
| type | TEXT |


Example:



Rent

Electricity

Salary

Transport



---

# 10. Report Templates Table


Purpose:

Store customizable reports.


Table:


report_templates



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| name | TEXT |
| columns | TEXT |
| filters | TEXT |
| created_by | INTEGER |
| created_at | DATETIME |


Example:


Template:


Monthly Finance Report

Columns:

Income

Expense

Balance



---

# 11. Settings Table


Purpose:

Store application configuration.


Table:


settings



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| key | TEXT |
| value | TEXT |


Examples:



business_name

logo_path

theme

currency



---

# 12. Activity Logs Table


Purpose:

Maintain audit history.


Table:


activity_logs



Fields:


| Field | Type |
|-|-|
| id | INTEGER |
| user_id | INTEGER |
| action | TEXT |
| module | TEXT |
| record_id | INTEGER |
| timestamp | DATETIME |


Examples:



Created member

Updated payment

Deleted expense



---

# 12b. Phone Shop Tables

# 12b.1 Suppliers Table

Purpose:
Track phone suppliers.

Table:

suppliers

Fields:

| Field | Type |
|-|-|
| id | INTEGER |
| name | TEXT |
| phone | TEXT |
| email | TEXT |
| address | TEXT |
| is_deleted | INTEGER |
| created_at | DATETIME |

---

# 12b.2 Inventory Table

Purpose:
Track phone stock per model.

Table:

inventory

Fields:

| Field | Type |
|-|-|
| id | INTEGER |
| brand | TEXT |
| model | TEXT |
| color | TEXT |
| storage | TEXT |
| cost_price | REAL |
| sale_price | REAL |
| quantity | INTEGER |
| supplier_id | INTEGER |
| low_stock_threshold | INTEGER |
| is_deleted | INTEGER |
| created_at | DATETIME |
| updated_at | DATETIME |

---

# 12b.3 Inventory IMEI Table

Purpose:
Track each physical phone unit by IMEI.

Table:

inventory_imei

Fields:

| Field | Type |
|-|-|
| id | INTEGER |
| inventory_id | INTEGER |
| imei | TEXT |
| status | TEXT |
| sold_at | DATETIME |
| created_at | DATETIME |

Rules:

- IMEI must be unique
- Status: in_stock / sold / returned

---

# 12b.4 Sales Table

Purpose:
Store phone sales.

Table:

sales

Fields:

| Field | Type |
|-|-|
| id | INTEGER |
| receipt_no | TEXT |
| member_id | INTEGER |
| total_amount | REAL |
| discount | REAL |
| paid_amount | REAL |
| payment_method | TEXT |
| notes | TEXT |
| created_by | INTEGER |
| created_at | DATETIME |

---

# 12b.5 Sale Items Table

Purpose:
Store the line items of each sale.

Table:

sale_items

Fields:

| Field | Type |
|-|-|
| id | INTEGER |
| sale_id | INTEGER |
| inventory_id | INTEGER |
| imei_id | INTEGER |
| quantity | INTEGER |
| unit_price | REAL |



---

# 13. Database Relationships


## Users and Roles



Role

1

|

Many

Users



---

## Members and Payments



Member

1

|

Many

Payments



---

## Categories and Expenses



Category

1

|

Many

Expenses



---

# 14. Indexing Strategy


Indexes should be created for frequently searched fields.


Required indexes:



members.phone

members.name

payments.payment_date

expenses.expense_date



Purpose:

- Faster search
- Faster filtering
- Better performance


---

# 15. Soft Delete Strategy


Important business records should not be permanently deleted.


Instead:


Add:



is_deleted BOOLEAN



Example:



Member deleted

↓

Record remains

↓

Hidden from normal views



Benefits:

- Data recovery
- Better audit history
- Safer operations


---

# 16. Data Validation Rules


Database level:


- Required fields
- Unique constraints
- Foreign keys


Backend level:


- Business validation
- Permission validation
- Transaction validation


Frontend level:


- User-friendly validation messages


---

# 17. Backup Considerations


The database should support:

- Full database backup
- Restore operation
- Version checking


Backup should include:



database file

settings

attachments

metadata



---

# 18. Future Database Expansion


The architecture should allow:


Future tables:



branches

inventory

notifications

documents

ai_insights

sync_history



---

# 19. Database Development Checklist


Before completing a database feature:


✓ Migration created

✓ Tables reviewed

✓ Relationships defined

✓ Indexes added

✓ Repository created

✓ Tests written

✓ Documentation updated
