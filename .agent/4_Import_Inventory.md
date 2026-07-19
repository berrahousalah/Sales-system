# Phase 4: Import Invoice & Supplier Returns Logic

## First: "Import Invoice" Page
This page is not merely a data entry screen; it is a live financial and inventory document that accepts modifications under strict validation rules.

### A. Invoice Header
* **Invoice Number:** Automatically generated and strictly non-editable.
* **Invoice Date:** Defaults to the current date (editable).
* **Supplier Name:** A strict dropdown menu pulling names exclusively from the "Suppliers" page.
* **Header Lock:** Once the invoice is saved for the first time, the "Invoice Header" (Supplier Name and Date) becomes permanently immutable and closed for modifications.

### B. Invoice Body (Products & Serial Numbers)
When clicking "Add Product to Invoice":
1. **Product Selection:** A strict dropdown menu pulling names exclusively from the "Products Management" page. (If the merchant enters a non-existent name, the system rejects it, blocks saving, and requires defining the product first).
2. **Quantity & Prices:** Fields to input the received quantity, the actual purchase price (for this batch), and the estimated retail price.
3. **Individual Registration (Serial Numbers Checkbox):**
    * When activated, "Serial Numbers" fields become mandatory, rendering empty input rows equal to the specified quantity.
    * **POS Logic:** The user scans the first item, the system inputs the serial number, and the cursor immediately shifts focus automatically (**Auto-focus**) to the next input row for the subsequent scan, and so on.
    * **Duplicate Protection:** The system strictly rejects any serial number that already exists within the inventory.
4. **Partial Row Lock Mechanism (Batch Protection):**
    * **Open Row:** A batch (row) from which zero units have been sold remains fully editable (Quantity, Purchase Price, Serial Numbers).
    * **Locked Row:** A batch from which at least one unit has been sold (whether serialized or regular quantity) immediately locks its price field. The total quantity **cannot be decreased below the number of units already sold**, and the remaining items cannot be registered individually. The fields tracking the sold quantity baseline, purchase price, and individual registration checkbox become **Read-Only**.
    * Other rows within the same invoice (that have not had their items sold) remain completely editable.
5. **Accounting Synchronization upon Modification (Save):**
    * The product units are purged from inventory in the case of reduction/deletion, and injected into inventory in the case of addition.
    * The "Invoice Total" automatically decrements by the purchase cost of deleted/reduced units and increments by the purchase cost of added units.
    * If the invoice has a remaining debt balance, the value of the reduced/returned items is immediately deducted from the supplier's debt. In the case of a quantity increase, the debt balance increments accordingly (unless the merchant manually adds the difference to the paid amount field).

### C. Amounts & Costs (Payment & Footer)
1. **Amount Paid (For Goods Only):** The merchant enters the exact cash amount handed over to the supplier.
2. **Remaining Amount (Debt):** Automatically calculated as `(Invoice Total - Amount Paid)`. This remaining balance is immediately routed to the supplier's profile ledger as an outstanding "Debt".
3. **Loading / Transportation Costs:** A dedicated field to document any overhead expenses incurred by the merchant to deliver the shipment.
4. **Financial Formula for Total:** `Invoice Total = (Sum of Purchase Prices × Quantities) + Transportation Costs`. (Upon saving, a new inventory `Batch` record is formally generated).

---

## Second: Query Logic
1. **For Serialized Goods:** The merchant enters the serial number into the "Search Bar" on the Import Invoices page, and the system instantly pulls up the original sourcing invoice document.
2. **For Regular Goods:** The merchant searches by the Supplier Name or Invoice Number to open the document.

---

## Third: "Supplier Returns" Page
To seamlessly handle offloading stock from a batch that has already undergone partial sales (the locked rows), a dedicated returns interface operates with the following rules:

1. **Display Nature:** This page does not list historical invoices. Instead, it displays **only products currently available in stock**, explicitly broken down and segmented by **Batches** (even if they belong to the identical product model).
2. **Return Mechanism:**
    * The merchant selects the Supplier -> selects the target Batch -> inputs the quantity to return (or specifies the exact active serial numbers if the batch is serialized).
3. **Backend Synchronization (Automated Logic):**
    * The returned units are completely deleted from active inventory and the system ledger.
    * The backend programmatically references the origin `ImportInvoice` (associated with that batch), reduces the "Invoice Total" by the absolute purchase cost of the returned goods, and updates the invoice's debt indicators (bypassing the row lock restriction).
    * The supplier's aggregate outstanding debt balance on the "Suppliers" page is immediately decremented by the same amount.
    * This completes the full loop: updating warehouse logs, correcting the source invoice, and adjusting supplier debt in one unified action from the live stock screen.