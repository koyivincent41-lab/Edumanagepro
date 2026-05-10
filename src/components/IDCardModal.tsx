import React, { useRef } from 'react';
import { X, Download } from 'lucide-react';
import { School, Student, Employee } from '../types';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface IDCardModalProps {
  school: School;
  type: 'student' | 'employee';
  person: Student | Employee | null;
  onClose: () => void;
}

export default function IDCardModal({ school, type, person, onClose }: IDCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!person) return null;

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    try {
      // Small delay to ensure images are fully loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const scale = 3; // high quality
      const canvas = await htmlToImage.toCanvas(cardRef.current, { 
        quality: 1, 
        pixelRatio: scale,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [54, 86] // standard ID card size
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 86, 54);
      pdf.save(`${school.name.replace(/\s+/g, '_')}_ID_${'staffNumber' in person ? person.staffNumber : person.admissionNumber}.pdf`);
      toast.success('ID Card downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate ID Card');
    }
  };

  const photoUrl = type === 'student' ? (person as Student).photoUrl : (person as Employee).profilePhoto;
  const idNumber = type === 'student' ? (person as Student).admissionNumber : (person as Employee).staffNumber;
  const roleOrClass = type === 'student' ? 'Student' : (person as Employee).jobTitle;
  const themeColor = school.primaryColor || '#4f46e5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">View ID Card</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-8 flex items-center justify-center bg-gray-50">
          {/* ID Card actual element - using fixed px for consistent htmlToImage export */}
          <div 
            ref={cardRef} 
            className="bg-white shadow-lg mx-auto relative overflow-hidden flex flex-col"
            style={{ width: '335px', height: '210px', boxSizing: 'border-box' }}
          >
            {/* Header / Letterhead */}
            <div 
              className="py-2 px-3 text-white flex items-center gap-3 flex-shrink-0"
              style={{ backgroundColor: themeColor }}
            >
              {school.logo ? (
                 <img crossOrigin="anonymous" src={school.logo} alt="School Logo" className="w-8 h-8 bg-white rounded-full object-contain shadow-sm" />
              ) : (
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-sm font-bold">{school.name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1 text-center pr-8">
                <h1 className="text-[12px] font-bold uppercase leading-tight font-serif tracking-wider">{school.name}</h1>
                <p className="text-[6px] opacity-90 uppercase tracking-widest mt-0.5">Identity Card</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex px-4 py-3 gap-4 items-center bg-white z-10 relative">
              {/* Profile Photo */}
              <div className="w-[70px] h-[85px] shrink-0 rounded-lg border-2 shadow-sm bg-gray-50 overflow-hidden flex items-center justify-center" style={{ borderColor: themeColor }}>
                {photoUrl ? (
                  <img crossOrigin="anonymous" src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                   <div className="text-gray-400 text-center">
                     <span className="text-[8px] uppercase font-bold">No Photo</span>
                   </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 flex flex-col justify-center overflow-hidden">
                <h2 className="text-[13px] font-black text-gray-900 uppercase leading-tight mb-1 truncate">
                  {person.fullName}
                </h2>
                <div 
                  className="text-[8px] font-bold uppercase py-0.5 px-2 rounded mb-2 w-fit shrink-0"
                  style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
                >
                  {roleOrClass}
                </div>

                <div className="space-y-1.5 w-full flex flex-col text-left">
                  <div className="w-full flex items-start flex-col sm:flex-row sm:items-center">
                    <span className="text-[7.5px] text-gray-500 font-semibold uppercase w-10 shrink-0">ID NO</span>
                    <span className="text-[8.5px] text-gray-900 font-bold truncate">{idNumber}</span>
                  </div>
                  {type === 'student' && (person as Student).dateOfBirth && (
                    <div className="w-full flex items-start flex-col sm:flex-row sm:items-center">
                      <span className="text-[7.5px] text-gray-500 font-semibold uppercase w-10 shrink-0">DOB</span>
                      <span className="text-[8.5px] text-gray-900 font-bold truncate">{(person as Student).dateOfBirth}</span>
                    </div>
                  )}
                  {type === 'employee' && (person as Employee).department && (
                    <div className="w-full flex items-start flex-col sm:flex-row sm:items-center">
                      <span className="text-[7.5px] text-gray-500 font-semibold uppercase w-10 shrink-0">DEPT</span>
                      <span className="text-[8.5px] text-gray-900 font-bold truncate max-w-[120px]">{(person as Employee).department}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Background Logo Watermark (Optional) */}
            {school.logo && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                <img crossOrigin="anonymous" src={school.logo} alt="" className="w-32 h-32 object-contain" />
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto h-6 flex items-center justify-between px-3 z-10 shrink-0" style={{ backgroundColor: `${themeColor}10` }}>
               <p className="text-[6px] text-gray-600 font-semibold ml-1">If found, return to: <span className="font-bold text-gray-900">{school.name}</span></p>
               <p className="text-[6px] text-gray-800 font-bold tracking-wider mr-1">{school.phone || school.email}</p>
            </div>
            
            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ backgroundColor: themeColor }}></div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
          <button 
            onClick={handleDownloadPDF}
            className="w-full py-2.5 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg"
            style={{ backgroundColor: themeColor, shadowColor: `${themeColor}40` }}
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
