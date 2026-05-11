import React from 'react';
import { X, CreditCard, Mail, Phone } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  price: number;
  packageName: string;
  schoolId: string;
  schoolName: string;
  packageId: string;
  billingCycle: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
  isOpen, 
  onClose, 
  price, 
  packageName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-4 md:p-8 max-w-lg w-full relative my-8 text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="h-6 w-6" />
        </button>
        
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-xl md:text-2xl font-black mb-2">Subscribe to {packageName}</h2>
        <p className="text-gray-500 mb-6 font-medium">Amount: ${price.toFixed(2)}</p>

        <div className="bg-gray-50 rounded-2xl p-4 md:p-6 mb-8">
          <p className="text-sm text-gray-600 mb-4">
            Online payments are currently being updated. To activate your subscription immediately, please contact our billing department.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary font-bold">
              <Phone className="h-4 w-4" />
              <span>+254 700 000 000</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-primary font-bold">
              <Mail className="h-4 w-4" />
              <span>billing@edumanagepro.com</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 bg-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-300 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};
