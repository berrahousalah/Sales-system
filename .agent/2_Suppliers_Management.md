# Suppliers & FIFO Debt Allocation Page Logic (Suppliers.md)

## 1. General Concept
* This page handles the creation and management of Supplier profiles from whom inventory is procured.
* A supplier must be registered here before they can be assigned to or selected within any Import Invoice workflow.

## 2. Supplier Data & Automated Debt Aggregation
* **Core Profile Data:** (only Full Name).
* **Total Debt Account Field:**
  * Displays an "Outstanding Debt" balance alongside each supplier's record.
  * This field is strictly **Read-Only** on the frontend. Its value dynamically updates (increments or decrements) based on financial interactions driven by the supplier's respective Import Invoices.

## 3. FIFO Debt Allocation Logic (Sequential Repayment)
When the merchant executes a financial payment to clear pending liabilities with a supplier, they click the "Pay Debt" button:
* **UI Specification:** Triggers a popup modal requesting the "Payment Amount".
* **Overpayment Prevention Guardrail:** The frontend and backend must strictly reject any entry where the payment amount exceeds the supplier's total outstanding aggregate debt. (Validation Rule: `Input Amount <= Supplier Total Debt`).
* **Backend Processing Execution (FIFO Algorithm):**
  1. Query all `ImportInvoice` records linked to this `SupplierId` where the remaining `Debt Balance > 0`.
  2. Sort the queried invoices chronologically from **oldest to newest (First-In, First-Out)**.
  3. Iteratively deduct the payment pool across the sorted invoices: fully clear the oldest invoice balance, flag it as "Fully Paid", and cascade any remaining payment balance to the next sequential invoice until the payment pool is exhausted.
  4. Database states for affected invoices must instantly update to either `Partially Paid` or `Fully Paid`.
  5. The supplier’s aggregate "Outstanding Debt" balance must instantly decrement by the total paid amount.

## 4. Bidirectional Synchronization & Invoice Constraints
* **Direct Invoice-Level Adjustment:** If the merchant navigates to the invoice module, opens a specific unpaid Import Invoice, and manually increments the "Amount Paid" field:
  * **Invoice Constraint Validation:** The system must block any entry that causes the "Amount Paid" to exceed the "Total Grand Amount" of that specific invoice.
  * **Instant Synchronization:** Upon saving the invoice edits, the backend must instantly recalculate and decrement the corresponding Supplier's "Outstanding Debt" by the exact delta added to that specific invoice. The system must maintain strict real-time bidirectional reactivity.