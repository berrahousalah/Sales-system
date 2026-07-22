"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { serializeMonthlyFinancialReport } from "@/lib/serialize";


// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME FINANCIAL AGGREGATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const DateRangeSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export async function getFinancialMetrics(data) {
  try {
    const parsed = DateRangeSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    // Format dates to cover the full day boundaries
    const start = new Date(parsed.data.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(parsed.data.endDate);
    end.setHours(23, 59, 59, 999);

    // 1. REVENUE & COGS (Direct Sales)
    // Formal Invoices
    const salesLines = await prisma.salesInvoiceLine.findMany({
      where: {
        salesInvoice: {
          invoiceDate: { gte: start, lte: end },
        },
      },
      select: {
        quantity: true,
        sellingPrice: true,
        purchasePriceSnapshot: true,
      },
    });

    let baseRevenue = 0;
    let baseCOGS = 0;
    for (const line of salesLines) {
      baseRevenue += line.quantity * parseFloat(line.sellingPrice);
      baseCOGS += line.quantity * parseFloat(line.purchasePriceSnapshot);
    }

    // Quick Sales (Direct POS)
    const quickSales = await prisma.quickSale.findMany({
      where: {
        saleDate: { gte: start, lte: end },
        isReturned: false, // standard logic: if it's returned in the same month, we just ignore it
      },
      select: {
        quantity: true,
        totalAmount: true,
        purchasePriceSnapshot: true,
      },
    });

    for (const qs of quickSales) {
      baseRevenue += parseFloat(qs.totalAmount);
      baseCOGS += qs.quantity * parseFloat(qs.purchasePriceSnapshot);
    }

    // 2. OPERATIONAL EXPENSES (Logistics & Adjustments)
    // Import Logistics
    const imports = await prisma.importInvoice.findMany({
      where: { invoiceDate: { gte: start, lte: end } },
      select: { transportationCost: true },
    });
    
    let baseLogistics = 0;
    for (const inv of imports) {
      baseLogistics += parseFloat(inv.transportationCost);
    }

    // Adjustment Losses
    const adjustments = await prisma.inventoryAdjustment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { financialLoss: true },
    });

    let baseAdjustmentLoss = 0;
    for (const adj of adjustments) {
      baseAdjustmentLoss += parseFloat(adj.financialLoss);
    }

    // 3. RETROACTIVE TRANSACTION LEDGER (The balancing mechanism)
    // Any returns/voids done *now* for months that were already closed
    const ledgerEntries = await prisma.transactionLedger.findMany({
      where: { createdAt: { gte: start, lte: end } },
    });

    let ledgerDeltaRevenue = 0;
    let ledgerDeltaCOGS = 0;
    let ledgerDeltaLogistics = 0;
    let ledgerDeltaAdjLoss = 0;

    for (const entry of ledgerEntries) {
      ledgerDeltaRevenue += parseFloat(entry.deltaRevenue);
      ledgerDeltaCOGS += parseFloat(entry.deltaCOGS);
      ledgerDeltaLogistics += parseFloat(entry.deltaLogistics);
      ledgerDeltaAdjLoss += parseFloat(entry.deltaAdjustmentLoss);
    }

    // 4. FINAL AGGREGATION
    const totalRevenue = baseRevenue + ledgerDeltaRevenue;
    const totalCOGS = baseCOGS + ledgerDeltaCOGS;
    const totalLogisticsExpenses = baseLogistics + ledgerDeltaLogistics;
    const totalAdjustmentLosses = baseAdjustmentLoss + ledgerDeltaAdjLoss;

    const grossProfit = totalRevenue - totalCOGS;
    const finalNetProfit = grossProfit - totalLogisticsExpenses - totalAdjustmentLosses;
    return { success: true,
      data: {
        totalRevenue: totalRevenue.toFixed(2),
        totalCOGS: totalCOGS.toFixed(2),
        totalLogisticsExpenses: totalLogisticsExpenses.toFixed(2),
        totalAdjustmentLosses: totalAdjustmentLosses.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        finalNetProfit: finalNetProfit.toFixed(2),
        ledgerCount: ledgerEntries.length
      }
    };
  } catch (error) {
    console.error("Financial aggregation error:", error);
    return { success: false, message: "Failed to compute financial metrics." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTH-END CLOSE (Immutable Archiving)
// ─────────────────────────────────────────────────────────────────────────────

const CloseMonthSchema = z.object({
  closingMonthId: z.string().regex(/^\d{4}-\d{2}$/, "Format must be YYYY-MM"),
});

export async function executeMonthEndClose(data) {
  try {
    const parsed = CloseMonthSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: parsed.error.errors[0].message };

    const { closingMonthId } = parsed.data;

    // Build exactly the start and end of that specific month
    const [yearStr, monthStr] = closingMonthId.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // last day of month

    // First check if already closed
    const existing = await prisma.monthlyFinancialReport.findUnique({
      where: { closingMonthId },
    });

    if (existing) {
      return { success: false, message: `Month ${closingMonthId} is already closed and archived.` };
    }

    // Run the aggregation specifically for that month bounds
    const metricsResult = await getFinancialMetrics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    if (!metricsResult.success) {
      throw new Error("Failed to compute final closing metrics.");
    }

    const m = metricsResult.data;

    // Securely write the immutable snapshot inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.monthlyFinancialReport.create({
        data: {
          closingMonthId,
          totalRevenue: parseFloat(m.totalRevenue),
          totalCOGS: parseFloat(m.totalCOGS),
          totalLogisticsExpenses: parseFloat(m.totalLogisticsExpenses),
          totalAdjustmentLosses: parseFloat(m.totalAdjustmentLosses),
          finalNetProfit: parseFloat(m.finalNetProfit),
          closedAt: new Date(),
        },
      });
      return report;
    });

    revalidatePath("/", "layout");
    return { success: true, message: `Successfully closed ${closingMonthId}.`, report: serializeMonthlyFinancialReport(result) };
  } catch (error) {
    console.error("Month-end close error:", error);
    return { success: false, message: error.message || "Failed to execute month-end close." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH ARCHIVED SNAPSHOTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getArchivedMonths() {
  try {
    const reports = await prisma.monthlyFinancialReport.findMany({
      orderBy: { closingMonthId: "desc" },
    });
    return { success: true, reports: reports.map(serializeMonthlyFinancialReport) };
  } catch (error) {
    return { success: false, message: "Failed to load financial archive." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FOR RETROACTIVE CHECKS (used in other modules)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a specific date falls into a month that has already been closed.
 */
export async function isMonthClosed(date) {
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const closingMonthId = `${year}-${month}`;

    const report = await prisma.monthlyFinancialReport.findUnique({
      where: { closingMonthId },
    });
    
    return !!report;
  } catch (error) {
    console.error("isMonthClosed check failed:", error);
    return false;
  }
}
