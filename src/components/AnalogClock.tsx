import React, { useEffect, useState } from 'react';

const AnalogClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours();

  const secondDegrees = (seconds / 60) * 360;
  const minuteDegrees = ((minutes + seconds / 60) / 60) * 360;
  const hourDegrees = (((hours % 12) + minutes / 60) / 12) * 360;

  return (
    <div className="relative w-32 h-32 rounded-full border-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl flex items-center justify-center transition-colors duration-300">
      {/* Clock Face Markings */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={`absolute w-0.5 ${i % 3 === 0 ? 'h-3 bg-maroon' : 'h-2 bg-gray-300 dark:bg-gray-600'}`}
          style={{
            transform: `rotate(${i * 30}deg) translateY(-54px)`,
            top: '50%',
            left: 'calc(50% - 1px)'
          }}
        />
      ))}

      {/* Center point */}
      <div className="absolute w-3 h-3 rounded-full bg-maroon z-20 shadow-sm border-2 border-white dark:border-gray-800" />
      
      {/* Hour hand */}
      <div 
        className="absolute w-1.5 h-10 bg-gray-900 dark:bg-gray-100 rounded-full origin-bottom z-10"
        style={{ 
          transform: `rotate(${hourDegrees}deg) translateY(-100%)`,
          top: '50%',
          left: 'calc(50% - 3px)',
          height: '40px'
        }}
      />
      
      {/* Minute hand */}
      <div 
        className="absolute w-1 h-14 bg-gray-600 dark:bg-gray-400 rounded-full origin-bottom z-10"
        style={{ 
          transform: `rotate(${minuteDegrees}deg) translateY(-100%)`,
          top: '50%',
          left: 'calc(50% - 2px)',
          height: '56px'
        }}
      />
      
      {/* Second hand */}
      <div 
        className="absolute w-0.5 h-16 bg-maroon rounded-full origin-bottom z-10"
        style={{ 
          transform: `rotate(${secondDegrees}deg) translateY(-100%)`,
          top: '50%',
          left: 'calc(50% - 1px)',
          height: '64px'
        }}
      />

      {/* Decorative inner circle */}
      <div className="absolute w-28 h-28 rounded-full border border-gray-50 dark:border-gray-700/50 pointer-events-none" />
    </div>
  );
};

export default AnalogClock;
