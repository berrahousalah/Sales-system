# Inventory Adjustments Page Logic (Inventory_Adjustments.md)

## 1. General Concept
* This module serves as an administrative audit and operational tool to reconcile discrepancies between digital inventory metrics (on-system stock) and physical stock counts (on-shelves stock).
* It provides a professional mechanism to legally write off inventory due to real-world variables such as damages, shrinkage/theft, internal business use, or audit miscounts.

## 2. Adjustment Entry Workflow (UI & Frontend)
To execute an inventory adjustment, the merchant interacts with a standardized form requiring four sequential inputs:
1. **Product Selection:** A dropdown menu pulling from the defined `Products` list.
2. **Batch Selection:** Once a product is chosen, the system displays a secondary dropdown showing all "Active Batches" for this SKU (displaying: Supplier Name, Entry Date, and Remaining Quantity). 
   * *Purpose:* This ensures the system knows the exact cost basis of the item being written off.
3. **Adjustment Quantity:** A numerical input specifying how many units are being adjusted out of stock.
4. **Reason Code:** A strict dropdown menu to categorize the write-off for accounting purposes:
   * `Damaged` (Broken/Expired item).
   * `Lost` (Theft/Shrinkage/Missing).
   * `Personal/Internal Use` (Withdrawn for showroom or owner use).
   * `Audit Correction` (Human error during previous counts).

## 3. Serialization Guardrails (Handling Serialized Batches)
If the selected batch was flagged as "Serialized" (Individual Tracking enabled) during the Import Invoice phase, the standard quantity input is restricted:
* **Forced SN Selection:** The system disables the plain numeric quantity input field and instead **forces** the merchant to either scan via POS or select the specific `Serial Number(s)` of the affected item(s).
* **Inventory Invalidation:** The inventory model must immediately update the status of these specific scanned Serial Numbers from `Available` to a non-sellable state matching the reason code (e.g., `Status = Damaged` or `Status = Lost`). This effectively "burns" and voids the unique SN from the active warehouse registers, making it impossible to add to any future Sales Invoices.

## 4. Backend Processing & Financial Ledger Impact (Accounting Logic)
Saving an adjustment triggers a real-time ledger update that prevents overstating net assets or net profits:
* **Inventory Count Reduction:** The physical count of the chosen batch is immediately decremented by the adjusted quantity.
* **Cost Absorption (Loss Logging):** The backend does not simply delete the stock. It reads the **Actual Purchase Price** of that specific batch, multiplies it by the written-off quantity, and automatically posts this value into the financial ledger as an **Operating Expense / Inventory Loss**.
* *Accounting Objective:* This guarantees that when the "Financials & Profitability" module calculates Net Profit, these hidden operational losses are subtracted directly from the gross revenue, rendering an accurate, real-world Net Profit calculation.