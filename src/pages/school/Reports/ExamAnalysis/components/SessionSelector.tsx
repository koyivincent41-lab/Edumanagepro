import React from 'react';
import { ExamSession } from '../../../../../types';
import { Calendar, ChevronDown } from 'lucide-react';

interface SessionSelectorProps {
  sessions: ExamSession[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function SessionSelector({ sessions, selectedId, onSelect }: SessionSelectorProps) {
  return (
    <div className="relative min-w-[240px]">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl group hover:border-primary transition-all">
        <Calendar className="h-5 w-5 text-primary" />
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-700 appearance-none cursor-pointer"
        >
          <option value="">Select Exam Session</option>
          {sessions.map(session => (
            <option key={session.id} value={session.id}>
              {session.examName} ({session.term} {session.academicYear})
            </option>
          ))}
        </select>
        <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
      </div>
    </div>
  );
}
