import React, { useState } from 'react';
import { School } from '../../../types';
import LearnerPromotion from './LearnerPromotion';
import PromotionHistory from './PromotionHistory';
import { ArrowUpRight, History } from 'lucide-react';

export default function PromotionsModule({ school }: { school: School }) {
  const [activeTab, setActiveTab] = useState<'promotion' | 'history'>('promotion');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learner Promotion</h1>
          <p className="text-sm text-gray-500">Promote learners to the next class for the new academic year</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex gap-1 inline-flex">
        <button
          onClick={() => setActiveTab('promotion')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'promotion'
              ? 'bg-maroon text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" />
          Promotion
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-maroon text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <History className="h-4 w-4" />
          History
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'promotion' ? (
          <LearnerPromotion school={school} />
        ) : (
          <PromotionHistory school={school} />
        )}
      </div>
    </div>
  );
}
