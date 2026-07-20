import Link from "next/link";
import { 
  Package, Users, Building2, Truck, FileText, Zap, 
  SlidersHorizontal, Landmark, ArrowRight, RotateCcw
} from "lucide-react";

export const metadata = {
  title: "ERP System | Dashboard",
};

const MODULES = [
  {
    title: "Products",
    description: "Manage the core catalog, pricing, and stock balances.",
    href: "/products",
    icon: <Package className="w-8 h-8 text-blue-600" />,
    bg: "bg-blue-50 border-blue-100",
  },
  {
    title: "Suppliers",
    description: "Track supplier profiles and outstanding debts.",
    href: "/suppliers",
    icon: <Building2 className="w-8 h-8 text-indigo-600" />,
    bg: "bg-indigo-50 border-indigo-100",
  },
  {
    title: "Customers",
    description: "Manage CRM profiles and customer receivables.",
    href: "/customers",
    icon: <Users className="w-8 h-8 text-cyan-600" />,
    bg: "bg-cyan-50 border-cyan-100",
  },
  {
    title: "Procurement",
    description: "Import invoices, batching, and serial logging.",
    href: "/import-invoices",
    icon: <Truck className="w-8 h-8 text-amber-600" />,
    bg: "bg-amber-50 border-amber-100",
  },
  {
    title: "Sales Invoices",
    description: "Formal sales, COD workflows, and debt sync.",
    href: "/sales-invoices",
    icon: <FileText className="w-8 h-8 text-violet-600" />,
    bg: "bg-violet-50 border-violet-100",
  },
  {
    title: "Quick Sales POS",
    description: "High-speed cash checkout and scanning.",
    href: "/quick-sales",
    icon: <Zap className="w-8 h-8 text-pink-600" />,
    bg: "bg-pink-50 border-pink-100",
  },
  {
    title: "Inventory Adjustments",
    description: "Write-off discrepancies and burn serials.",
    href: "/inventory-adjustments",
    icon: <SlidersHorizontal className="w-8 h-8 text-rose-600" />,
    bg: "bg-rose-50 border-rose-100",
  },
  {
    title: "Financials & Reports",
    description: "Immutable month-end closes & real-time metrics.",
    href: "/financials",
    icon: <Landmark className="w-8 h-8 text-emerald-600" />,
    bg: "bg-emerald-50 border-emerald-100",
  },
  {
    title: "Supplier Returns & Stock",
    description: "Return stock to suppliers & import initial inventory.",
    href: "/supplier-returns",
    icon: <RotateCcw className="w-8 h-8 text-orange-600" />,
    bg: "bg-orange-50 border-orange-100",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center text-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
          
          <div className="relative z-10 space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Resource</span> Planning
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Fully integrated suite managing procurement, serialized stock, point-of-sale, customer debts, and immutable financial reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MODULES.map((mod) => (
            <Link 
              key={mod.href} 
              href={mod.href}
              className={`group flex flex-col justify-between p-6 rounded-2xl border bg-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${mod.bg}`}
            >
              <div>
                <div className="mb-4 bg-white/50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm backdrop-blur-sm border border-white/40">
                  {mod.icon}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{mod.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  {mod.description}
                </p>
              </div>
              
              <div className="flex items-center text-sm font-bold text-gray-900 gap-2 group-hover:gap-3 transition-all">
                Launch Module <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
