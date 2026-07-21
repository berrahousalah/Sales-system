"use client";

import { useState } from "react";
import { Info, Trash2, Loader2, Package } from "lucide-react";
import ProductDetailsModal from "./ProductDetailsModal";
import { deleteProduct } from "../actions";
import { useRouter } from "next/navigation";

export default function ProductsTable({ initialProducts }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  const handleDelete = async (productId) => {
    if (!confirm("Voulez-vous vraiment supprimer ce produit ?")) return;
    
    setDeletingId(productId);
    setDeleteError("");
    
    const result = await deleteProduct(productId);
    
    if (result.success) {
      if (result.archived) {
        alert(result.message); // Inform user it was soft-deleted
      }
      router.refresh();
    } else {
      setDeleteError(result.message);
      alert(result.message);
    }
    
    setDeletingId(null);
  };

  if (initialProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun produit trouvé</h3>
        <p className="text-gray-700 font-medium text-center max-w-sm">
          Commencez par créer votre premier produit. Il servira de base pour tout votre inventaire.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
        {deleteError && (
          <div className="bg-red-50 p-3 text-red-600 text-sm font-medium border-b border-red-100">
            {deleteError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Nom du Produit</th>
                <th className="px-6 py-4 font-semibold text-right">Stock Total Disponible</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-700 font-bold shrink-0">
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                      {product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      product.stockBalance > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.stockBalance} en stock
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Détails du Produit"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        title="Supprimer le Produit"
                      >
                        {deletingId === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailsModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </>
  );
}
