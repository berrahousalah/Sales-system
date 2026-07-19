# Customers & Accounts Receivable Page Logic (Customers.md)

## 1. General Concept
* This page handles the creation and management of Customer profiles to whom products are sold.
* It operates as the exact inverse of the Suppliers module, managing Accounts Receivable (debts owed to the shop).
* A customer must be registered here with their primary details before they can be assigned to or selected within any Sales Invoice workflow.

## 2. Customer Data & Automated Debt Tracking
* **Core Profile Data:** (onlyFull Name).
* **Total Receivable Balance Field:**
  * Displays an "Outstanding Debt" balance alongside each customer's record.
  * This field is strictly **Read-Only** on the frontend. Its value dynamically updates (increments or decrements) automatically based on financial interactions driven by the customer's respective Sales Invoices.

## 3. FIFO Collection Allocation Logic (Sequential Debt Clearing)
When the merchant receives a financial payment from a customer to clear their accumulated debts, they click the "Collect Debt" button:
* **UI Specification:** Triggers a popup modal requesting the "Received Amount".
* **Overpayment Prevention Guardrail:** The frontend and backend must strictly reject any entry where the collected amount exceeds the customer's total outstanding aggregate debt. (Validation Rule: `Input Amount <= Customer Total Debt`).
* **Backend Processing Execution (FIFO Algorithm):**
  1. Query all `SalesInvoice` records linked to this `CustomerId` where the remaining `Debt Balance > 0`.
  2. Sort the queried invoices chronologically from **oldest to newest (First-In, First-Out)**.
  3. Iteratively deduct the payment pool across the sorted invoices: fully clear the oldest invoice balance, flag it as "Fully Paid", and cascade any remaining collected balance to the next sequential invoice until the collected money pool is exhausted.
  4. Database states for affected invoices must instantly update to either `Partially Paid` or `Fully Paid`.
  5. The customer's aggregate "Outstanding Debt" balance must instantly decrement by the total collected amount.

## 4. Bidirectional Synchronization & Invoice Constraints
* **Direct Invoice-Level Adjustment:** If the merchant navigates to the sales invoice module, opens a specific unpaid Sales Invoice, and manually increments or adds to the "Amount Paid" field:
  * **Invoice Constraint Validation:** The system must block any entry that causes the "Amount Paid" to exceed the "Total Grand Amount" of that specific invoice.
  * **Instant Synchronization:** Upon saving the invoice edits, the backend must instantly recalculate and decrement the corresponding Customer's "Outstanding Debt" by the exact delta added to that specific invoice. The system must maintain strict real-time bidirectional reactivity.