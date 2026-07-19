# Project Guardrails & Architectural Constraints

## 1. Core Tech Stack
- **Language:** Pure JavaScript (ES6+ Node.js / Next.js) ONLY. TypeScript (.ts/.tsx) is strictly forbidden.
- **Database Layer:** Prisma ORM. Database connections must rely directly on `schema.prisma` and the `.env` file. Programmatic configuration files (like `prisma.config.ts`) are strictly banned.

## 2. Functional & Architecture Rules
- **Source of Truth:** All modules, business rules, validational hooks, and algorithms must be explicitly derived from the local logic documentation files 
1_Products_Management.md Page 1 logic: Product definition, base pricing, initial categorization, and SKU/Item setup.
2_Suppliers_Management.md Page 2 logic: Supplier profiles, read-only aggregate debt counters, and FIFO allocation logic.3_Customers_Management.md Page 3 logic: Customer tracking, outstanding receivables account, and inverse FIFO payment collection rules.4_Import_Invoice.md Page 4 logic: Live procurement sheets, serial scanning POS mechanics, row-level batch locks, and initial debt dispatch.
5_Sales_Invoice.md Page 5 logic: Live point-of-sale sheet, manual batch splitting, delivery/COD override adjustments, and 5-step return triggers.
6_Inventory_Adjustments.md Page 6 logic: Internal stock adjustments (damages/loss/theft), forced SN invalidation, and expense ledger cost updates.
7_Financials_And_Reports.md Page 7 logic: Time-filtered real-time discovery analytics, append-only transaction ledger, and immutable snapshot archives.
- **No Placeholders:** All generated services, API routes, and utilities must be fully functional, complete, and production-ready. No `// TODO` or skipped implementation blocks.
- **Data Safety:** Multi-tenant/multi-location tracking, decimal scaling safety, atomic database transactions (`prisma.$transaction`), and strong input validation are mandatory.
