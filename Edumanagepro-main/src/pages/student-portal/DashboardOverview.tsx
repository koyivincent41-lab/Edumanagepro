import React from 'react';
import { 
  UserSquare2, 
  BookOpen, 
  CalendarClock,
  Video
} from 'lucide-react';

export default function DashboardOverview({ session }: { session: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-3xl text-white shadow-xl">
        <h1 className="text-2xl font-black">Welcome back, {session.fullName}!</h1>
        <p className="mt-2 text-white/80 font-medium">Here is an overview of your student portal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <UserSquare2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">My Profile</p>
            <p className="font-bold text-gray-900 mt-1">{session.fullName}</p>
            <p className="text-xs text-gray-500">{session.admissionNumber}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Video className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold uppercase">Live Classes</p>
            <p className="font-bold text-gray-900 mt-1">Pending/Upcoming</p>
            <p className="text-xs text-gray-500">Check module for details</p>
          </div>
        </div>
      </div>
    </div>
  );
}
