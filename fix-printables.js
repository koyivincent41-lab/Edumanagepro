const fs = require('fs');

const files = [
  'src/pages/school/Invoices.tsx',
  'src/pages/parent-portal/Invoices.tsx',
  'src/pages/school/Receipts.tsx',
  'src/pages/parent-portal/Receipts.tsx',
  'src/pages/parent-portal/MyChildren.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Fix main printable div padding
  content = content.replace(/className="flex-1 overflow-y-auto p-12 (bg-white(?: dark:bg-gray-900)?) print:p-0"/g, 'className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 $1 print:p-0"');

  // Fix Letterhead flex
  content = content.replace(/className="flex justify-between items-start mb-12 border-b-4 pb-8"/g, 'className="flex flex-col md:flex-row justify-between items-center md:items-start mb-8 md:mb-12 border-b-4 pb-6 md:pb-8 gap-6 md:gap-0 text-center md:text-left"');
  // Handle MyChildren if different
  content = content.replace(/className="flex justify-between items-start mb-12 border-b-4 pb-8 dark:border-gray-800"/g, 'className="flex flex-col md:flex-row justify-between items-center md:items-start mb-8 md:mb-12 border-b-4 pb-6 md:pb-8 gap-6 md:gap-0 text-center md:text-left dark:border-gray-800"');

  // Fix inner letterhead gap and items
  content = content.replace(/className="flex items-center gap-4 md:gap-6"/g, 'className="flex flex-col md:flex-row items-center gap-4 md:gap-6 w-full md:w-auto"');

  // Fix logo class
  content = content.replace(/className="h-24 w-24 object-contain rounded-2xl shadow-sm"/g, 'className="h-16 w-16 md:h-24 md:w-24 object-contain rounded-2xl shadow-sm shrink-0"');
  content = content.replace(/className="h-24 w-24 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-3xl md:text-4xl shadow-lg"/g, 'className="h-16 w-16 md:h-24 md:w-24 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl md:text-4xl shadow-lg shrink-0"');

  // Fix school name
  content = content.replace(/className="text-xl md:text-3xl font-black tracking-tighter text-gray-900(?: dark:text-white)? uppercase"/g, (match) => match.replace('text-xl m', 'text-lg m') + ' break-words text-center md:text-left max-w-full');

  // Fix address/contact block
  content = content.replace(/className="mt-3 text-sm text-gray-500(.*?) space-y-0\.5 font-medium"/g, 'className="mt-2 md:mt-3 text-xs md:text-sm text-gray-500$1 space-y-0.5 font-medium break-words text-center md:text-left"');
  content = content.replace(/<p>Tel:/g, '<p className="break-all sm:break-normal">Tel:');

  // Fix right alignment container (Invoice/Date)
  content = content.replace(/<div className="text-right">/g, '<div className="text-center md:text-right w-full md:w-auto mt-4 md:mt-0 flex flex-col items-center md:items-end">');

  // Check Bill To grid
  content = content.replace(/className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12 mb-8 md:mb-12"');
  content = content.replace(/className="bg-gray-50(?: dark:bg-gray-800\/50)? p-4 md:p-8 rounded-\[2rem\] border border-gray-100(?: dark:border-gray-800)?"/g, 'className="bg-gray-50 dark:bg-gray-800/50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 dark:border-gray-800"');
  content = content.replace(/className="bg-gray-50(?: dark:bg-gray-800\/50)? p-4 md:p-8 rounded-\[2rem\] border border-gray-100(?: dark:border-gray-800)? flex flex-col justify-center"/g, 'className="bg-gray-50 dark:bg-gray-800/50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col justify-center"');


  // Replace table wrapper with overflow padding
  content = content.replace(/<div className="mb-12">/g, '<div className="mb-8 md:mb-12 overflow-x-auto">');
  
  // Also adjust the text sizing for invoice/receipt number and totals
  content = content.replace(/className="text-3xl md:text-4xl font-black text-gray-900/g, 'className="text-2xl md:text-4xl font-black text-gray-900');
  content = content.replace(/className="py-6 text-right text-xl md:text-2xl font-black/g, 'className="py-4 md:py-6 text-right text-lg md:text-2xl font-black');
  content = content.replace(/className="py-6 text-lg font-black/g, 'className="py-4 md:py-6 text-sm md:text-lg font-black');
  
  // Receipt uses py-6 text-lg font-black text-gray-900 uppercase tracking-tighter" for Total Amount sometimes
  // Ensure the min-w is fine. Since it's inside overflow-x-auto, min-w is okay.

  fs.writeFileSync(file, content, 'utf8');
});
