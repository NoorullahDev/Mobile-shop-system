# AI Coding Rules and Development Guidelines

## 1. Purpose

This document defines rules for AI-assisted development.

The goal is to ensure AI-generated code remains:

- Consistent
- Maintainable
- Secure
- Testable
- Professional
- Aligned with project architecture


---

# 2. AI Developer Role

AI acts as a senior software engineer.

AI responsibilities:

- Understand existing architecture
- Follow project rules
- Write clean code
- Create tests
- Explain important changes
- Avoid unnecessary modifications


AI must not behave like a code generator only.

---

# 3. Before Writing Code


Before creating or modifying any code, AI must review:



01_PROJECT_OVERVIEW.md

02_PRODUCT_REQUIREMENTS.md

03_TECHNICAL_ARCHITECTURE.md

05_DATABASE_DESIGN.md

06_FRONTEND_UI_GUIDELINES.md

07_BACKEND_DEVELOPMENT_GUIDELINES.md



Purpose:

Understand:

- Product goals
- Architecture
- Coding patterns
- UI rules
- Database rules


---

# 4. General Coding Rules


AI must:


✓ Follow existing folder structure

✓ Reuse existing components

✓ Follow naming conventions

✓ Keep code modular

✓ Avoid duplicate logic

✓ Write readable code


AI must not:


❌ Create random files

❌ Change architecture without approval

❌ Create duplicate solutions

❌ Ignore existing patterns


---

# 5. Feature Development Workflow


Every feature must follow:



Requirement Analysis

↓

Database Design

↓

Backend Implementation

↓

Frontend Implementation

↓

Testing

↓

Documentation Update



Never implement only the UI without backend planning.

---

# 6. Database Rules


Before changing database:


AI must:


1. Review current schema

2. Create migration

3. Update models

4. Update repositories

5. Add tests


Never:


❌ Modify database manually

❌ Delete tables without migration

❌ Break existing relationships


---

# 7. Backend AI Rules


When creating Rust code:


Follow:



Command

↓

Service

↓

Repository

↓

Database



AI must:


- Keep commands simple
- Put logic in services
- Put SQL in repositories
- Handle errors properly


Never:


❌ Put SQL inside commands

❌ Put business logic inside UI

❌ Ignore error handling


---

# 8. Frontend AI Rules


Before creating UI:


Check:

- Existing components
- Design system
- Similar pages


AI must:


✓ Reuse components

✓ Follow UI guidelines

✓ Add loading states

✓ Add empty states

✓ Add error handling


Never:


❌ Create random layouts

❌ Use inconsistent colors

❌ Create unnecessary components


---

# 9. UI Quality Rules


Every screen should have:


## Layout

- Proper spacing
- Clear hierarchy
- Professional appearance


## Tables

Must include:


- Search
- Filters
- Sorting
- Pagination


## Forms

Must include:


- Validation
- Error messages
- Clear actions


---

# 10. Testing Rules


Every feature requires tests.


Minimum:


Backend:

- Unit tests


Database:

- Repository tests


Frontend:

- Component tests


Example:


Feature:

Create Member


Required:



Member creation works

Invalid data rejected

Database saves correctly

UI updates correctly



---

# 11. Bug Fixing Rules


When fixing bugs:


AI must:


Step 1:

Understand the root cause


Step 2:

Fix the actual issue


Step 3:

Add prevention test


Step 4:

Update documentation if needed


Never:


❌ Apply random fixes

❌ Hide errors

❌ Remove functionality to avoid bugs


---

# 12. Code Modification Rules


When editing existing code:


AI should:


- Make minimum required changes
- Preserve working functionality
- Explain affected areas


Avoid:


Large unnecessary rewrites.


---

# 13. Dependency Rules


Before adding packages:


AI must evaluate:


- Is it necessary?
- Is there an existing solution?
- Does it increase complexity?


Avoid unnecessary dependencies.


---

# 14. Security Rules


AI must always consider:


- Input validation
- Permission checking
- Data protection
- Secure storage


Never:


❌ Store passwords directly

❌ Expose sensitive information

❌ Bypass authentication


---

# 15. Documentation Rules


After major changes:


Update:


- Product requirements
- Architecture documentation
- Database documentation
- Changelog


Documentation must stay synchronized with code.


---

# 16. Communication Rules


When making changes, AI should explain:


## What changed?

Example:

"Added payment service layer."


## Why?

Example:

"Moved calculation logic from command to service."


## Impact?

Example:

"Existing payment workflow remains unchanged."


---

# 17. AI Code Review Checklist


Before completing any task, AI should verify:


Architecture:

✓ Correct layer used


Backend:

✓ Error handling added


Database:

✓ Migration created


Frontend:

✓ UI follows guidelines


Testing:

✓ Tests created


Documentation:

✓ Updated if required


---

# 18. Prompt Template For AI


Use this format:



You are working on the Mobile Shop System.

Before coding:

Read project documentation.

Follow:

Technical Architecture
Coding Guidelines
UI Guidelines

Task:

[Describe feature]

Requirements:

[Feature details]

Rules:

Follow existing patterns
Create tests
Do not break existing features
Update documentation


---

# 19. Final AI Principle


AI should improve the project, not just add code.


Every generated change must make the system:


- Cleaner
- Safer
- More maintainable
- More professional


The goal is not faster coding.

The goal is professional software development with AI assistance.
