import { useState, useRef, useEffect } from "react";
import { ScanLine, X, CheckCircle, AlertCircle } from "lucide-react";

export default function ScanSerialRemoval({ originalSerials, selectedToRemove, onToggleRemove, targetRemovalCount }) {
  // Maintain local state for each slot's input text
  const [inputs, setInputs] = useState(Array(targetRemovalCount).fill(""));
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef([]);

  // Keep refs array in sync
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, targetRemovalCount);
  }, [targetRemovalCount]);

  const handleKeyDown = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputs[index].trim();
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

      // Valid, lock it in via parent
      onToggleRemove(val, true);

      // Clear this slot's input
      const newInputs = [...inputs];
      newInputs[index] = "";
      setInputs(newInputs);

      // Focus next empty slot
      const nextEmpty = Array.from({ length: targetRemovalCount }).findIndex(
        (_, i) => !selectedToRemove[i] && i !== index
      );
      if (nextEmpty !== -1 && inputRefs.current[nextEmpty]) {
        inputRefs.current[nextEmpty].focus();
      }
    }
  };

  const handleInputChange = (index, value) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  // We have exactly targetRemovalCount slots
  const slots = Array.from({ length: targetRemovalCount });

  return (
    <div className="mt-4 p-4 bg-white border border-indigo-200 rounded-lg shadow-sm text-left w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Sélectionner les Numéros de Série à Retirer
        </h3>
        <div
          className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
            selectedToRemove.length === targetRemovalCount
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-amber-100 text-amber-700 border border-amber-200"
          }`}
        >
          {selectedToRemove.length === targetRemovalCount && <CheckCircle className="w-3.5 h-3.5" />}
          Retiré(s): {selectedToRemove.length} / {targetRemovalCount}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-1.5 p-2 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-md">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {slots.map((_, index) => {
          // If the parent array has a locked serial at this index, show it locked
          const lockedSerial = selectedToRemove[index];

          return (
            <div key={index} className="flex flex-col">
              <label className="text-[11px] font-semibold text-slate-500 mb-1 tracking-wide uppercase">
                Slot {index + 1} of {targetRemovalCount}
              </label>

              {lockedSerial ? (
                <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-md text-sm shadow-sm transition-all">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-red-500" />
                    <span className="font-mono text-red-700 font-medium">{lockedSerial}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleRemove(lockedSerial, false);
                    }}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Annuler le retrait"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    value={inputs[index] || ""}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder="Scanner ou taper puis [Entrée]..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-md text-sm text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50 placeholder-slate-400 shadow-sm transition-all"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
