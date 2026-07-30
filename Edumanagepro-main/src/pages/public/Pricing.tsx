import React from 'react';
import PublicLayout from '@/components/PublicLayout';

export default function Pricing() {
  const prices = [
    { name: 'Basic', price: '$9', description: 'For small schools' },
    { name: 'Pro', price: '$29', description: 'For growing schools' },
    { name: 'Enterprise', price: '$99', description: 'For big institutions' }
  ];

  return (
    <PublicLayout>
      <div className="p-10">
        <h1 className="text-4xl font-bold text-center mb-10">Pricing</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {prices.map((plan) => (
            <div key={plan.name} className="p-6 border rounded-lg shadow-sm">
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="text-xl font-semibold my-2">{plan.price}</p>
              <p>{plan.description}</p>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Select Plan</button>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
