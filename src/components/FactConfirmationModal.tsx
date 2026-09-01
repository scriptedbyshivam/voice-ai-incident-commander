'use client';

import React from 'react';

interface FactConfirmationModalProps {
  isOpen: boolean;
  factTitle: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const FactConfirmationModal: React.FC<FactConfirmationModalProps> = ({
  isOpen,
  factTitle,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-black text-white">Confirm Fact Verification</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Are you sure you want to promote <span className="text-indigo-300 font-bold">"{factTitle}"</span> to a confirmed fact?
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
          >
            Confirm & Verify
          </button>
        </div>
      </div>
    </div>
  );
};

export default FactConfirmationModal;
