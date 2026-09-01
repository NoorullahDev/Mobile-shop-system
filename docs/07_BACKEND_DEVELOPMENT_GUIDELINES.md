# Backend Development Guidelines

## 1. Purpose

This document defines backend development standards for the Mobile Shop System.

The backend is responsible for:

- Business logic
- Database operations
- Security
- Validation
- File handling
- Report generation


Backend Technology:

Rust + Tauri


---

# 2. Backend Architecture

The backend follows a layered architecture.



Tauri Commands

    ↓

Service Layer

    ↓

Repository Layer

    ↓

Database Layer



Each layer has a specific responsibility.


---

# 3. Folder Structure


Backend structure:



src-tauri/src/

├── commands/

├── services/

├── repositories/

├── models/

├── database/

├── migrations/

├── security/

├── errors/

└── utils/



---

# 4. Commands Layer


## Purpose

The command layer is the communication bridge between React and Rust.


Example:


```rust
#[tauri::command]
fn create_member() {}
```

## Responsibilities

Commands should:

- Receive frontend requests
- Validate input format
- Check permissions
- Call service functions
- Return responses

Commands Should NOT:

❌ Contain business logic

❌ Perform complex calculations

❌ Directly write SQL queries

**Bad:**

Command

↓

insert into members...

calculate payment...


**Good:**

Command

↓

Service

↓

Repository

---

# 5. Service Layer

## Purpose

The service layer contains business rules.

Examples:

- member_service.rs
- payment_service.rs
- report_service.rs

## Responsibilities

Services handle:

- Business calculations
- Validation rules
- Workflows
- Transactions
- Permission logic

Example (Payment Service):

Receive Payment

↓

Validate Amount

↓

Update Balance

↓

Save Transaction

↓

Create Activity Log

---

# 6. Repository Layer

## Purpose

The repository layer manages database communication.

Examples:

- member_repository.rs
- payment_repository.rs
- expense_repository.rs

## Responsibilities

Repositories handle:

- SQL queries
- Data insertion
- Data updates
- Data retrieval
- Database mapping

## Repository Rules

Repositories should:

✓ Be simple

✓ Only handle database operations

✓ Return structured data

Repositories should NOT:

❌ Calculate business rules

❌ Handle UI decisions

---

# 7. Models

## Purpose

Models represent application data.

Examples:

- Member
- Payment
- Expense
- User

## Rules:

- Use clear naming
- Keep structures organized
- Avoid unnecessary fields

Example:

```rust
struct Member {
    id: i64,
    name: String,
    phone: Option<String>
}
```

---

# 8. Database Access Rules

## Rule 1

Never access SQLite directly from commands.

**Wrong:**

Command

↓

SQLite

**Correct:**

Command

↓

Service

↓

Repository

↓

SQLite

## Rule 2

Use prepared statements.

Never create unsafe SQL strings.

## Rule 3

Use transactions for important operations.

Required for:

- Payments
- Financial updates
- Multiple table changes

---

# 9. Error Handling

All backend errors must use centralized error handling.

Example:

```rust
enum AppError {
    DatabaseError,
    ValidationError,
    PermissionDenied,
    AuthenticationError,
    FileError
}
```

## Error Rules

Never:

❌ Panic in production

❌ Return raw database errors to users

Always:

✓ Log technical details

✓ Return user-friendly messages

---

# 10. Validation Rules

Validation must happen in backend.

Examples:

**Member:**
- Name required
- Valid phone format

**Payment:**
- Amount must be positive
- Date must be valid

Frontend validation improves experience.

Backend validation protects data.

---

# 11. Authentication Rules

Authentication must be handled by Rust.

Requirements:

- Secure password storage
- Session management
- Role checking

---

# 12. Authorization Rules

Every protected command must verify:

User

↓

Role

↓

Permission

↓

Action

Example (Deleting financial records):
Only Admin can perform.

---

# 13. Logging Rules

Important actions must create logs.

Examples:

- User Login
- Member Created
- Payment Received
- Expense Deleted
- Report Generated

Log format:

- User
- Action
- Module
- Record ID
- Timestamp

---

# 14. File Handling Rules

Files include:

- Images
- Attachments
- Reports
- Backups

Rules:

- Validate file type
- Use safe paths
- Handle missing files
- Avoid storing unnecessary copies

---

# 15. Report Generation Rules

Reports should be generated through backend.

Flow:

Frontend Request

↓

Report Command

↓

Report Service

↓

Data Repository

↓

PDF Generator

---

# 16. Testing Rules

Every backend feature requires tests.

Example:

**Member Service Tests:**
- Create valid member
- Reject empty name
- Update member
- Delete member

**Payment Service Tests:**
- Accept valid payment
- Reject negative amount
- Calculate balance correctly

---

# 17. Performance Rules

Backend should:

- Avoid unnecessary database queries
- Use indexes
- Use transactions
- Keep functions focused

---

# 18. Code Quality Rules

Every Rust module should:

✓ Have a single responsibility

✓ Use meaningful names

✓ Avoid duplicate code

✓ Include error handling

✓ Include tests where required

---

# 19. AI Backend Development Rules

When AI creates backend code:

AI must:

- Check existing architecture
- Create proper layer separation
- Never bypass services
- Never put SQL in commands
- Add tests
- Update documentation

---

# 20. Backend Feature Completion Checklist

Before marking complete:

✓ Model created

✓ Migration created

✓ Repository created

✓ Service created

✓ Command created

✓ Error handling added

✓ Tests written

✓ Documentation updated
