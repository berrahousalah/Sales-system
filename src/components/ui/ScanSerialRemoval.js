import { useState, useRef } from "react";
import { ScanLine, X, CheckCircle } from "lucide-react";

export default function ScanSerialRemoval({ originalSerials, selectedToRemove, onToggleRemove, targetRemovalCount }) {
  const [inputValue, setInputValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputValue.trim();
      if (!val) return;

      setErrorMsg("");

      // Validate serial exists in original line
      if (!originalSerials.includes(val)) {
        setErrorMsg(`Numéro de série "${val}" introuvable.`);
        return;
      }

      // Check if it's already removed
      if (selectedToRemove.includes(val)) {
        setErrorMsg(`Numéro de série "${val}" est déjà retiré.`);
        return;
      }

      // Check if we hit the limit
      if (selectedToRemove.length >= targetRemovalCount) {
        setErrorMsg(`Limite de retrait (${targetRemovalCount}) atteinte.`);
        return;
      }

      // It's valid, select it for removal
      onToggleRemove(val, true);
      setInputValue("");
    }
  };

  return (
    <div className="mt-2 p-3 bg-white border border-indigo-200 rounded-md shadow-sm text-left min-w-[250px]">
      <div className="flex justify-between items-end mb-2">
        <p className="text-xs font-medium text-slate-800">
          Scanner pour Retirer
        </p>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedToRemove.length === targetRemovalCount ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          Retiré(s): {selectedToRemove.length} / {targetRemovalCount}
        </div>
      </div>

      <div className="relative mb-2">
        <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scanner ou taper le N/S..."
          disabled={selectedToRemove.length >= targetRemovalCount}
          className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded text-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:opacity-75"
        />
      </div>

      {errorMsg && (
        <p className="text-[10px] text-red-600 mb-2 font-medium">{errorMsg}</p>
      )}

      {selectedToRemove.length > 0 && (
        <div className="max-h-24 overflow-y-auto space-y-1 mt-2 border-t pt-2">
          {selectedToRemove.map(sn => (
            <div key={sn} className="flex items-center justify-between p-1.5 bg-red-50 border border-red-100 rounded text-xs">
              <span className="font-mono text-red-700 font-medium">{sn}</span>
              <button 
                onClick={(e) => { e.preventDefault(); onToggleRemove(sn, false); }}
                className="text-red-500 hover:text-red-700 transition-colors"
                title="Annuler le retrait"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {selectedToRemove.length === targetRemovalCount && (
        <div className="text-[10px] text-green-600 flex items-center gap-1 mt-2 font-medium">
          <CheckCircle className="w-3 h-3" />
          Quantité atteinte
        </div>
      )}
    </div>
  );
}
