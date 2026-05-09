import React, { useState } from 'react';
import { X, Navigation, Search, AlertCircle, Loader2 } from 'lucide-react';
import { Vehicle, Route as TransportRoute } from '../types';

interface WazeTrackerModalProps {
  vehicle: Vehicle | null;
  route?: TransportRoute | null;
  onClose: () => void;
}

export default function WazeTrackerModal({ vehicle, route, onClose }: WazeTrackerModalProps) {
  const [enteredId, setEnteredId] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!vehicle) return null;

  // Generic coordinates for demo (Nairobi)
  const lat = -1.2921; 
  const lon = 36.8219;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!enteredId.trim()) {
      setError('Please enter a Tracking ID');
      return;
    }

    setLoading(true);
    
    // Simulate network delay for verification
    setTimeout(() => {
      // Allow exact match, or 'DEMO' for ease of testing
      if (enteredId.trim().toUpperCase() === vehicle.trackingId || enteredId.trim().toUpperCase() === 'DEMO') {
        setIsVerified(true);
      } else {
        setError('Invalid Tracking ID. Please check and try again.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col h-[80vh] animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              Live Bus Tracking
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Vehicle: <span className="font-semibold text-gray-900">{vehicle.registrationNumber}</span> 
              {route && <span> • Route: <span className="font-semibold text-gray-900">{route.name}</span></span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 w-full relative bg-gray-100">
          {!isVerified ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-6">
              <form onSubmit={handleVerify} className="max-w-md w-full bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Navigation className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">GPS Tracking Gateway</h3>
                <p className="text-sm text-gray-500 mb-8">
                  Please enter the Tracking ID for vehicle <span className="font-bold text-gray-900">{vehicle.registrationNumber}</span>. 
                  Contact the school if you do not have the Tracking ID.
                </p>
                
                <div className="space-y-4 text-left">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tracking ID</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder={vehicle.trackingId ? `e.g. ${vehicle.trackingId}` : 'Enter ID'}
                        value={enteredId}
                        onChange={(e) => setEnteredId(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none uppercase font-mono tracking-widest text-lg"
                      />
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    )}
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying Connection...
                      </>
                    ) : (
                      <>
                        <Navigation className="w-5 h-5" />
                        Connect to Live GPS
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <iframe 
                src={`https://embed.waze.com/iframe?zoom=14&lat=${lat}&lon=${lon}&pin=1`}
                width="100%" 
                height="100%" 
                frameBorder="0"
                className="absolute inset-0 w-full h-full"
                title="Waze Map"
              />
              <div className="absolute top-4 left-4 right-4 md:right-auto bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-bold text-sm animate-in slide-in-from-top mt-2">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                Live GPS Active • ID: {vehicle.trackingId || enteredId.toUpperCase()}
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200 flex flex-col items-center">
                 <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Driver</span>
                 <span className="text-sm font-black text-gray-900">{vehicle.driverName} • {vehicle.driverPhone}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
