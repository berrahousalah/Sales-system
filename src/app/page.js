import Link from "next/link";
import { 
  Package, Users, Building2, Truck, FileText, Zap, 
  SlidersHorizontal, Landmark, ArrowRight
} from "lucide-react";

export const metadata = {
  title: "ERP System | Dashboard",
};

const MODULES = [
  {
    title: "Produits",
    description: "Gérer le catalogue principal, les prix et les stocks.",
    href: "/products",
    icon: <Package className="w-8 h-8 text-blue-600" />,
    bg: "bg-blue-50 border-blue-200",
  },
  {
    title: "Fournisseurs",
    description: "Suivre les profils des fournisseurs et les dettes.",
    href: "/suppliers",
    icon: <Building2 className="w-8 h-8 text-indigo-600" />,
    bg: "bg-indigo-50 border-indigo-200",
  },
  {
    title: "Clients",
    description: "Gérer les profils clients et les créances.",
    href: "/customers",
    icon: <Users className="w-8 h-8 text-cyan-600" />,
    bg: "bg-cyan-50 border-cyan-200",
  },
  {
    title: "Factures d'Importation",
    description: "Factures d'achat, lots et gestion des numéros de série.",
    href: "/import-invoices",
    icon: <Truck className="w-8 h-8 text-amber-600" />,
    bg: "bg-amber-50 border-amber-200",
  },
  {
    title: "Factures de Vente",
    description: "Ventes formelles, paiements à la livraison et suivi des dettes.",
    href: "/sales-invoices",
    icon: <FileText className="w-8 h-8 text-violet-600" />,
    bg: "bg-violet-50 border-violet-200",
  },
  {
    title: "Caisse (Vente Rapide)",
    description: "Point de vente rapide et scan de codes-barres.",
    href: "/quick-sales",
    icon: <Zap className="w-8 h-8 text-pink-600" />,
    bg: "bg-pink-50 border-pink-200",
  },
  {
    title: "Ajustements de Stock",
    description: "Corriger les écarts et gérer les pertes.",
    href: "/inventory-adjustments",
    icon: <SlidersHorizontal className="w-8 h-8 text-rose-600" />,
    bg: "bg-rose-50 border-rose-200",
  },
  {
    title: "Finances & Rapports",
    description: "Clôtures mensuelles et indicateurs de performance.",
    href: "/financials",
    icon: <Landmark className="w-8 h-8 text-emerald-600" />,
    bg: "bg-emerald-50 border-emerald-200",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center text-center">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
          
          <div className="relative z-10 space-y-4">
            <div className="inline-block px-3 py-1 mb-2 border border-blue-500/30 bg-blue-500/10 rounded-full text-blue-300 text-sm font-semibold tracking-widest uppercase">
              Propulsé par TechnoLink
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Système ERP <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">TechnoLink</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
              Suite intégrée gérant les achats, le stock sérialisé, la caisse, les dettes et les rapports financiers.
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
                <p className="text-sm text-gray-700 font-medium leading-relaxed mb-6">
                  {mod.description}
                </p>
              </div>
              
              <div className="flex items-center text-sm font-bold text-gray-900 gap-2 group-hover:gap-3 transition-all">
                Ouvrir le module <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
