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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md landing-card p-6 space-y-4">
        <h3 className="text-lg font-bold">Confirm this fact?</h3>
        <p className="text-sm text-white/50 leading-relaxed">
          Mark <span className="text-[#33d1ff] font-medium">&ldquo;{factTitle}&rdquo;</span> as a confirmed fact?
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-landing-outline text-sm py-2 px-4">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-landing-primary text-sm py-2 px-4">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default FactConfirmationModal;
