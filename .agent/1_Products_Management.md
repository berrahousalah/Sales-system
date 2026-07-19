# Product & Inventory Management Page Logic (Products.md)

## 1. General Concept
* This page serves as the "Single Source of Truth" (SSOT) for all inventory items.
* No product can exist or be used in any inventory transaction (Import, Sale, or Adjustment) unless it is first defined and created within this module.

## 2. Product Creation Logic
* **UI Specification:** A streamlined form containing only the "Product Name" field and a "Save" button.
* **Backend Constraints:**
  * Upon saving a new product, it must be initialized with a default stock balance of zero (`Stock Balance = 0`).
  * Manual entry of initial quantities or prices is strictly prohibited in this view (stock levels must only be incremented via Import Invoices).

## 3. Product Details & Batches Modal
* Every product entry in the datatable must feature a "Product Details" button.
* **UI Behavior:** Clicking this button triggers a modal displaying a granular breakdown of the total stock based on the "Independent Batches" architecture (Batch-level tracking).
* **Modal Datagrid Breakdown (Per Batch):**
  * Supplier Name.
  * Entry Date (Date of Import).
  * Current Remaining Quantity in this specific batch.
  * Actual Purchase Price.
  * Suggested Retail Price.
* **Accounting Objective:** Provides the merchant with immediate visibility into cost fluctuations and pricing rationales for the exact same SKU based on separate procurement lifecycles.

## 4. Data Integrity & Soft Delete Guardrails
* **Strict Backend Constraint:** Hard deletion (`Hard Delete`) of any product entity is strictly prohibited if the record is linked to any historical transactions (Import Invoices, Sales Invoices, or existing Inventory Batches).
* **Archiving Mechanism (Soft Delete):**
  * When a user triggers a deletion, the system must check for historical references. If references exist, the system flags the product state as `Archived` or `Soft Deleted`.
  * **Result:** The product is immediately filtered out and hidden from dropdown menus and selection lists in all newly generated sales or import workflows. However, the record remains immutable in the database to preserve the data integrity of legacy invoices and financial reports.