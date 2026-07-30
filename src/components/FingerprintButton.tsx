import React from 'react';
import { Fingerprint } from 'lucide-react';

interface FingerprintButtonProps {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}

export const FingerprintButton: React.FC<FingerprintButtonProps> = ({ onClick, label, disabled }) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-2xl shadow-primary/50 hover:scale-105 transition-transform active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
      >
        <Fingerprint className="w-24 h-24" />
      </button>
      <p className="text-lg font-bold text-gray-800">{label}</p>
    </div>
  );
};
