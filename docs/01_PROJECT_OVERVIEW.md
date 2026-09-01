# Project Overview

## 1. Project Name

Mobile Shop System

---

## 2. Project Description

Mobile Shop System is a professional offline desktop application designed to help mobile phone shops manage their daily operations digitally.

It combines mobile phone shop operations (phone stock/inventory, IMEI tracking, sales and receipts, suppliers/purchasing) with general business management (members/customers, payments, expenses, reports, settings).

The application replaces manual registers, spreadsheets, and disconnected tools with a centralized, secure, and easy-to-use management platform.

The system is built using:

- Tauri 2.0
- Rust Backend
- React + TypeScript Frontend
- SQLite Database

The application works completely offline and stores business data locally with strong security and reliability.

---

# 3. Project Vision

The vision is to create a lightweight, fast, secure, and professional desktop management solution for small and medium businesses.

The software should provide:

- Simple user experience
- Professional enterprise-level interface
- Accurate business records
- Fast operations
- Secure local data storage
- Customizable reports
- Long-term maintainability


---

# 4. Main Objectives

The system should:

- Digitize business operations
- Reduce manual paperwork
- Provide accurate financial tracking
- Manage members/customers efficiently
- Track payments and expenses
- Generate professional reports
- Provide useful business insights
- Maintain data security
- Work without internet dependency


---

# 5. Target Users

## Business Owner / Admin

Responsibilities:

- Manage complete business operations
- View reports
- Manage users
- Configure settings
- Monitor finances


## Staff Users

Responsibilities:

- Perform daily operations
- Add records
- Receive payments
- Update information according to permissions


## Accountant

Responsibilities:

- Manage financial records
- View income and expenses
- Generate financial reports


---

# 6. Core Application Modules

## Dashboard

Purpose:

Provide a complete overview of business performance.

Main Features:

- KPI cards
- Revenue summary
- Expense summary
- Pending payments
- Recent activities
- Charts and analytics


---

## Members Management

Purpose:

Manage customer/member information.

Features:

- Create members
- Update members
- Delete members
- Search members
- Filter members
- View member details
- Payment history


---

## Finance Management

Purpose:

Handle all financial activities.

Features:

- Receive payments
- Record expenses
- Track balances
- Manage transactions
- View financial summaries


---

## Reports

Purpose:

Provide customizable business reports.

Features:

- Weekly reports
- Monthly reports
- Yearly reports
- Custom date range reports
- PDF export
- Print support
- Custom templates


---

## Settings

Purpose:

Allow administrators to customize application behavior.

Features:

- Business information
- User management
- Permissions
- Backup settings
- Application preferences


---

# 7. Development Philosophy

The project follows professional software engineering principles.

## Main Rules:

- Clean architecture
- Modular development
- Reusable components
- Strong separation of concerns
- Automated testing
- Secure coding practices
- Maintainable codebase


---

# 8. Development Approach

Every feature must follow this workflow:


Requirement

↓

Database Design

↓

Backend Implementation

↓

Frontend Implementation

↓

Automated Testing

↓

UI Review

↓

Documentation Update



No feature is considered complete without:

- Proper implementation
- Testing
- Documentation


---

# 9. Quality Goals

The application should achieve:

## Performance

- Fast startup
- Smooth UI experience
- Efficient database queries


## Security

- Protected user data
- Secure authentication
- Permission-based access


## Reliability

- No data corruption
- Safe database operations
- Backup and restore support


## Maintainability

- Clean code structure
- Clear documentation
- Easy future expansion


---

# 10. Future Expansion

The architecture should allow future features:

- Multi-branch support
- Cloud synchronization
- Mobile application
- AI analytics
- Advanced accounting
- Third-party integrations


---

# 11. Technology Summary

| Layer | Technology |
|---|---|
| Desktop Framework | Tauri 2.0 |
| Backend | Rust |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite |
| Testing | Rust Tests + Frontend Tests |
| Build System | Tauri Bundler |


---

# 12. Documentation Rule

Before modifying any major functionality, developers and AI assistants must review:

- Technical Architecture
- Product Requirements
- Database Design
- Coding Guidelines

All architectural decisions must be documented.
