# Frontend UI Guidelines

## 1. Purpose

This document defines frontend design and development rules.

The objective is to create:

- Professional user experience
- Consistent visual language
- Reusable components
- Clean layouts
- Maintainable frontend code


---

# 2. Frontend Technology

The frontend uses:


## Framework

React + TypeScript


## Styling

Tailwind CSS


## State Management

Zustand


## Charts

Recharts


---

# 3. Design Philosophy


The application should feel like:

- Professional SaaS dashboard
- Enterprise desktop software
- Clean business application


The UI must avoid:

- Random colors
- Excessive animations
- Large unnecessary elements
- Inconsistent spacing
- Generic AI-generated layouts


---

# 4. Design System


## Typography


Primary Font:

Inter


Font Rules:

- Clear hierarchy
- Readable sizes
- Proper spacing


Example:



Page Title

24px / Bold

Section Title

18px / Semi Bold

Normal Text

14px



---

# 5. Color System


Use a consistent color palette.


## Primary

Used for:

- Main actions
- Links
- Active states


## Success

Used for:

- Completed payments
- Positive numbers


## Warning

Used for:

- Pending actions
- Alerts


## Danger

Used for:

- Errors
- Delete actions


## Neutral

Used for:

- Backgrounds
- Borders
- Text


---

# 6. Layout Structure


Main application layout:



Sidebar

    Top Navbar

    Main Content Area


---

# 7. Sidebar Guidelines


Sidebar should include:


- Logo
- Navigation items
- User profile
- Settings


Rules:


- Fixed position
- Clear active state
- Icons with labels
- Proper spacing


Example:



Dashboard

Members

Finance

Reports

Settings



---

# 8. Dashboard Design


The dashboard should contain:


## KPI Cards


Each card includes:


- Title
- Main value
- Trend indicator
- Icon


Example:



Total Revenue

Rs 250,000

↑ 12% this month



Rules:


- Equal height cards
- Consistent spacing
- Avoid unnecessary decoration


---

# 9. Charts


Charts should be used for:


- Trends
- Comparisons
- Analytics


Recommended:


- Line charts
- Bar charts
- Area charts


Rules:


- Clear labels
- Proper legends
- Avoid excessive colors


---

# 10. Data Table Guidelines


Tables are a major part of the application.


Every professional table should support:


## Required Features


✓ Search

✓ Filtering

✓ Sorting

✓ Pagination

✓ Column visibility

✓ Export option


---

Example:



Name Status Payment Actions

Ali Active Paid Edit Delete



---

# 11. Table Rules


Avoid:


❌ Huge unnecessary tables

❌ Missing empty states

❌ Random column order


Use:


✓ Sticky headers

✓ Proper alignment

✓ Clear actions

✓ Responsive design


---

# 12. Forms Design


Forms should be:


- Simple
- Organized
- Easy to complete


Rules:


## Required Fields

Show clearly.


Example:



Name *

Phone
Email
Address



## Optional Fields

Should not overwhelm users.


Use:


- Collapsible sections
- Advanced options


---

# 13. Modal Guidelines


Modals should be used for:


- Create forms
- Edit forms
- Confirmation


Rules:


- Clear title
- Proper spacing
- Cancel button
- Primary action button


---

# 14. Button System


Buttons must follow consistent patterns.


Primary:


Save Payment



Secondary:


Cancel



Danger:


Delete



Rules:


- Same height
- Same radius
- Same typography


---

# 15. Component Library


Reusable components must be created.


Required components:



Button

Input

Select

Modal

Card

KPI Card

Data Table

Filter Bar

Pagination

Dropdown

Toast Notification

Loading State

Empty State



---

# 16. Page Structure Rules


Every page should follow:



Page Header

↓

Actions Area

↓

Filters

↓

Main Content

↓

Pagination



---

# 17. Empty States


Never show blank screens.


Example:


No Members:



No members found.

Create your first member to get started.

[Add Member]



---

# 18. Loading States


Every async operation needs:


- Loading indicator
- Disabled actions
- Error handling


Examples:


- Saving data
- Loading tables
- Generating reports


---

# 19. Error Handling UI


Errors should be:


- User friendly
- Clear
- Actionable


Bad:


Error 500



Good:


Unable to save payment.

Please check your internet/device storage and try again.



---

# 20. Responsive Design


Even though this is desktop software:


Support:


- Different screen sizes
- Laptop resolutions
- Large monitors


---

# 21. Animation Guidelines


Animations should be:


- Fast
- Purposeful
- Professional


Allowed:


✓ Modal transitions

✓ Hover effects

✓ Loading animations


Avoid:


❌ Excessive movement

❌ Distracting effects


---

# 22. Frontend Code Organization


Recommended:



components/

Button/

DataTable/

KpiCard/

pages/

Dashboard/

Members/

Finance/

hooks/

services/

types/



---

# 23. Frontend Quality Checklist


Before completing any UI:


✓ Consistent spacing

✓ Proper typography

✓ Reusable components

✓ Loading states added

✓ Empty states added

✓ Error handling added

✓ No duplicate components

✓ Professional appearance reviewed


---

# 24. AI Frontend Rules


When generating UI:


AI must:


- Reuse existing components
- Follow design system
- Avoid creating random styles
- Maintain consistency
- Check existing pages before creating new ones


Never create a new UI pattern without approval.
