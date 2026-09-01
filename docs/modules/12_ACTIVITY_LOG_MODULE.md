# Activity Log Module Documentation

## 1. Purpose

The Activity Log module records all important actions performed inside the system.

It provides:

- Audit history
- User activity tracking
- Security monitoring
- Data change tracking
- Administrative transparency


The goal is to answer:

"Who changed what, when, and from where?"


---

# 2. Module Overview

The Activity Log system works across all modules.


Events are generated from:



Authentication

Members

Payments

Expenses

Reports

Settings

Backup

Users

License



Flow:



User Performs Action

↓

Module Generates Event

↓

Activity Service Receives Event

↓

Store Log

↓

Admin Can Review History



---

# 3. Activities To Track


## User Activities


Examples:



User Login

User Logout

Failed Login Attempt

Password Changed



---

## Member Activities


Examples:



Member Created

Member Updated

Member Deleted

Member Restored



---

## Financial Activities


Examples:



Payment Added

Payment Updated

Payment Deleted

Expense Created

Expense Modified



---

## System Activities


Examples:



Settings Changed

Backup Created

Backup Restored

License Updated



---

# 4. Activity Log Information


Each activity should store:



User

Action

Module

Record ID

Description

Old Value

New Value

Date

Time



---

# 5. Example Activity Records


Example 1:



User:

Admin

Action:

Created Payment

Module:

Finance

Description:

Created payment of Rs 5000

Time:

10:30 AM



---

Example 2:



User:

Manager

Action:

Changed Currency

Old Value:

USD

New Value:

PKR



---

# 6. Activity Log Viewer


Admin interface should display:


Table:



Date

User

Module

Action

Description

Details



Actions:



View Details

Filter

Export



---

# 7. Activity Filtering


Filters:


## User Filter



Select User



---

## Module Filter



Members

Finance

Reports

Settings



---

## Date Filter



Today

This Week

This Month

Custom Range



---

# 8. Activity Details View


When opening an activity:


Display:



Activity Information

User:

Admin

Action:

Updated Payment

Before:

Amount: 5000

After:

Amount: 7000

Timestamp:

Date and Time



---

# 9. Frontend Requirements


Required pages:



ActivityLogPage

ActivityDetailsPage



Components:



ActivityTable

ActivityFilter

ActivityDetailsCard

ChangeViewer



---

# 10. UI Requirements


Activity interface should provide:


✓ Professional data table

✓ Search

✓ Filters

✓ Sorting

✓ Pagination

✓ Detail view


---

# 11. Change Comparison UI


For updated records:


Show difference:


Example:


Before:


Amount: 5000



After:


Amount: 7000



---

# 12. Backend Architecture


Structure:



commands/

activity_commands.rs

services/

activity_service.rs

repositories/

activity_repository.rs

models/

activity_log.rs



---

# 13. Activity Service Responsibilities


Handles:


- Creating logs
- Formatting descriptions
- Tracking changes
- Searching logs
- Filtering logs


---

# 14. Automatic Logging System


Important actions should automatically create logs.


Example:


Payment creation:



Payment Service

↓

Activity Service

↓

Save Activity Log



---

# 15. Database Requirements


## Activity Logs Table



activity_logs



Fields:



id

user_id

module

action

record_id

description

old_values

new_values

ip_address

created_at



---

# 16. Database Relationships


User relationship:



User

1

|

Many

Activity Logs



---

# 17. Business Rules


## Rule 1

Important actions cannot be removed by normal users.


---

## Rule 2

Activity logs should be append-only.


Meaning:



Create

↓

Never Modify



---

## Rule 3

Sensitive information should not be stored in logs.


Example:


Do not store:



Passwords



---

# 18. Permissions


Required permissions:



activity.view

activity.export

activity.delete



Default:


Only administrators can view complete logs.


---

# 19. Error Handling


Unable to create log:



Activity could not be recorded.



Database failure:



Unable to load activity history.



---

# 20. Testing Requirements


## Backend Tests


### Create Activity Log


Expected:



Log created successfully



---

### User Tracking


Test:


User performs action


Expected:



Correct user stored



---

### Change Tracking


Test:


Update payment amount


Expected:



Old and new values stored



---

### Permission Test


Staff tries viewing admin logs


Expected:



Access denied



---

# Frontend Tests


Test:


✓ Activity table

✓ Filters

✓ Search

✓ Details view

✓ Pagination

✓ Export


---

# 21. Performance Requirements


Activity logs may grow very large.


Required:


- Database indexing
- Pagination
- Date-based filtering
- Efficient queries


Indexes:



user_id

module

created_at



---

# 22. Security Requirements


Activity logs protect against:


- Unauthorized changes
- Data manipulation
- Security issues


Rules:


- Backend controls access
- Logs cannot be edited manually
- Sensitive data excluded


---

# 23. Future Improvements


Possible features:


- Advanced audit dashboard

- Security threat detection

- AI activity summaries

- Export compliance reports

- Real-time monitoring


---

# 24. Completion Checklist


Before completing Activity Log module:


✓ Logging service created

✓ Database table created

✓ Automatic logging integrated

✓ Admin viewer created

✓ Filters completed

✓ Permissions added

✓ Tests completed

✓ Documentation updated
