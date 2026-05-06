import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString(undefined, options);
  };

  return (
    <div className="flex items-center gap-4 px-6 py-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all duration-300">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary animate-pulse" />
        <div className="text-xl font-black font-mono tracking-wider text-primary dark:text-white">
          {formatTime(time)}
        </div>
      </div>
      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
      <div className="hidden sm:flex flex-col items-start leading-tight">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">
          {time.toLocaleDateString(undefined, { weekday: 'long' })}
        </div>
        <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
          {time.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default DigitalClock;
