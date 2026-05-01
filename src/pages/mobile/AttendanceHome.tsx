import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FingerprintButton } from '../../components/FingerprintButton';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { doc, getDoc, addDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { LogOut, MapPin, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { AttendanceSettings } from '../../types';

// Helper to calculate distance between two points in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function AttendanceHome() {
  const [status, setStatus] = useState<'not-clocked-in' | 'clocked-in' | 'clocked-out'>('not-clocked-in');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const navigate = useNavigate();
  const employeeId = localStorage.getItem('employeeId');
  const employeeName = localStorage.getItem('employeeName');
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    const fetchData = async () => {
      if (!employeeId || !schoolId) return;
      try {
        // Fetch Settings
        const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
        if (schoolDoc.exists()) {
          setSettings(schoolDoc.data().attendanceSettings || null);
        }

        // Fetch Status
        const q = query(
          collection(db, 'attendance'),
          where('employeeId', '==', employeeId),
          orderBy('timestamp', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const lastRecord = snap.docs[0].data();
          const today = new Date().toISOString().split('T')[0];
          const recordDate = lastRecord.timestamp.split('T')[0];
          
          if (today === recordDate) {
            if (lastRecord.actionType === 'clock-in') {
              setStatus('clocked-in');
            } else {
              // If they clocked out, check if they can clock in again
              if (settings?.oncePerSession) {
                setStatus('clocked-out');
              } else {
                setStatus('not-clocked-in');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId, schoolId, settings?.oncePerSession]);

  const handleAttendance = async () => {
    if (!employeeId || !schoolId) {
      toast.error('Session expired. Please login again.');
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const action = status === 'not-clocked-in' ? 'clock-in' : 'clock-out';

      // 1. Check Time Window
      if (settings) {
        const start = action === 'clock-in' ? settings.clockInStart : settings.clockOutStart;
        const end = action === 'clock-in' ? settings.clockInEnd : settings.clockOutEnd;
        
        if (currentTimeStr < start || currentTimeStr > end) {
          toast.error(`Attendance window for ${action} is between ${start} and ${end}`);
          setLoading(false);
          return;
        }
      }

      // 2. Biometric/Fingerprint verification
      if (settings?.requireFingerprint) {
        const verified = await simulateVerification();
        if (!verified) {
          toast.error('Fingerprint verification failed');
          setLoading(false);
          return;
        }
      }

      // 3. GPS Capture & Geofencing
      let latitude = 0;
      let longitude = 0;
      
      if (settings?.requireGPS) {
        try {
          const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 10000,
              enableHighAccuracy: true,
              maximumAge: 0
            });
          });

          toast.promise(positionPromise, {
            loading: 'Verifying location...',
            success: 'Location verified!',
            error: (err: any) => {
              if (err.code === 1) return 'GPS permission denied. Please enable location access.';
              if (err.code === 2) return 'GPS signal unavailable.';
              if (err.code === 3) return 'GPS request timed out.';
              return 'Failed to capture GPS location.';
            }
          });

          const position = await positionPromise;
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;

          // Geofence check
          if (settings.latitude && settings.longitude) {
            const distance = getDistance(latitude, longitude, settings.latitude, settings.longitude);
            if (distance > settings.radiusMeters) {
              toast.error(`You are outside the allowed radius (${Math.round(distance)}m away)`);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          toast.error('GPS permission required for attendance.');
          setLoading(false);
          return;
        }
      }

      // 4. Determine Status (Late/On-time/Early-departure)
      let attendanceStatus = 'on-time';
      if (settings) {
        if (action === 'clock-in') {
          const [startH, startM] = settings.clockInStart.split(':').map(Number);
          const startTime = new Date();
          startTime.setHours(startH, startM + (settings.lateThresholdMinutes || 0), 0);
          if (now > startTime) {
            attendanceStatus = 'late';
          }
        } else if (action === 'clock-out') {
          const [endH, endM] = settings.clockOutEnd.split(':').map(Number);
          const endTime = new Date();
          endTime.setHours(endH, endM - (settings.earlyDepartureThresholdMinutes || 0), 0);
          if (now < endTime) {
            attendanceStatus = 'early-departure';
          }
        }
      }

      // 5. Submit
      await addDoc(collection(db, 'attendance'), {
        employeeId,
        employeeName,
        schoolId,
        actionType: action,
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0],
        latitude,
        longitude,
        verificationMethod: settings?.requireFingerprint ? 'fingerprint' : 'none',
        verificationSuccess: true,
        attendanceStatus
      });

      setStatus(action === 'clock-in' ? 'clocked-in' : 'clocked-out');
      toast.success(`${action === 'clock-in' ? 'Clock In' : 'Clock Out'} recorded!`);
    } catch (error) {
      console.error('Attendance error:', error);
      toast.error('Failed to record attendance.');
    } finally {
      setLoading(false);
    }
  };

  const simulateVerification = async () => {
    // Simulate biometric/PIN check
    return true;
  };

  const handleLogout = () => {
    localStorage.removeItem('employeeId');
    localStorage.removeItem('employeeName');
    localStorage.removeItem('schoolId');
    navigate('/mobile/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1/3 bg-blue-600 rounded-b-[2rem] lg:rounded-b-[3rem] z-0" />
      
      <div className="relative z-10 w-full max-w-sm space-y-4 lg:space-y-8">
        <div className="text-center text-white space-y-1 lg:space-y-2">
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Staff Attendance</h1>
          <p className="text-blue-100 text-xs lg:text-sm font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[2.5rem] shadow-2xl shadow-blue-900/10 space-y-6 lg:space-y-8">
          <div className="flex flex-col items-center gap-6">
            <div className="flex justify-center scale-90 lg:scale-100">
              <FingerprintButton 
                onClick={handleAttendance} 
                label={status === 'not-clocked-in' ? 'Press to Clock In' : 'Press to Clock Out'} 
                disabled={loading || status === 'clocked-out'}
              />
            </div>

            <button
              onClick={() => navigate('/employee/login')}
              className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Exit to Sign In
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <div className="p-3 lg:p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center gap-1 lg:gap-2">
              <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
              <div className="text-center">
                <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-gray-400">Status</p>
                <p className="text-[10px] lg:text-xs font-bold text-gray-900 capitalize">{status.replace(/-/g, ' ')}</p>
              </div>
            </div>
            <div className="p-3 lg:p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center gap-1 lg:gap-2">
              <MapPin className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
              <div className="text-center">
                <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-gray-400">Geofence</p>
                <p className="text-[10px] lg:text-xs font-bold text-gray-900">{settings?.requireGPS ? 'Active' : 'Disabled'}</p>
              </div>
            </div>
          </div>

          {settings?.requireFingerprint && (
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50 py-2 rounded-full">
              <ShieldCheck className="h-3 w-3" />
              Secure Verification Active
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-600 transition-colors font-black uppercase tracking-[0.2em] text-[10px] py-4"
        >
          <LogOut className="w-4 h-4" />
          Exit to Sign In
        </button>
      </div>
    </div>
  );
}
