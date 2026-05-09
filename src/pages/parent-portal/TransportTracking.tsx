import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile, School, Student, Vehicle, Route as TransportRoute } from '../../types';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Bus, MapPin, Loader2, Navigation, Users, Copy } from 'lucide-react';
import { toast } from 'sonner';
import WazeTrackerModal from '../../components/WazeTrackerModal';

export default function TransportTracking({ profile }: { profile: UserProfile }) {
  const [children, setChildren] = useState<(Student & { routeDetails?: TransportRoute, vehicleDetails?: Vehicle })[]>([]);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [trackingVehicle, setTrackingVehicle] = useState<{ vehicle: Vehicle, route: TransportRoute } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!profile.schoolId || !profile.uid) return;

        // Fetch School currency
        const schoolDoc = await getDoc(doc(db, 'schools', profile.schoolId));
        if (schoolDoc.exists()) setSchool({ id: schoolDoc.id, ...schoolDoc.data() } as School);

        // Fetch Parent ID
        let parentId = profile.uid;
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnap = await getDocs(parentsQuery);
        if (!parentsSnap.empty) {
          parentId = parentsSnap.docs[0].id;
        }

        // Fetch Children
        const childrenQuery = query(
          collection(db, 'schools', profile.schoolId, 'students'), 
          where('parentId', '==', parentId)
        );
        const childrenSnap = await getDocs(childrenQuery);
        const kids = childrenSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));

        // Fetch Transport details for children using transport
        const transportWorthyKids = await Promise.all(kids.map(async kid => {
          if (!kid.usesTransport || !kid.routeId || !kid.vehicleId) return kid;

          const routeDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'routes', kid.routeId));
          const vehicleDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'vehicles', kid.vehicleId));

          const routeDetails = routeDoc.exists() ? { id: routeDoc.id, ...routeDoc.data() } as TransportRoute : undefined;
          const vehicleDetails = vehicleDoc.exists() ? { id: vehicleDoc.id, ...vehicleDoc.data() } as Vehicle : undefined;

          return { ...kid, routeDetails, vehicleDetails };
        }));

        setChildren(transportWorthyKids);
      } catch (error) {
        console.error("Error fetching transport details:", error);
        toast.error("Failed to load transport information");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  if (loading) {
    return (
      <ParentLayout profile={profile}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ParentLayout>
    );
  }

  const kidsWithTransport = children.filter(c => c.usesTransport);
  const kidsWithoutTransport = children.filter(c => !c.usesTransport);

  return (
    <ParentLayout profile={profile}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Transport Tracking</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">View transport details, routes, and vehicle info for your children.</p>
        </div>

        {kidsWithTransport.length === 0 && kidsWithoutTransport.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm">
            <p className="text-gray-500 font-medium">No children linked to your account.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {kidsWithTransport.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {kidsWithTransport.map(kid => (
                  <div key={kid.id} className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Bus className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{kid.fullName}</h2>
                        <p className="text-xs text-indigo-600 font-black uppercase tracking-widest">{kid.admissionNumber}</p>
                      </div>
                    </div>

                    {kid.routeDetails && kid.vehicleDetails ? (
                      <div className="space-y-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Route:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{kid.routeDetails.name}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Vehicle:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{kid.vehicleDetails.registrationNumber} ({kid.vehicleDetails.make})</span>
                          </div>
                          {kid.vehicleDetails.trackingId && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500 dark:text-gray-400 font-medium">Tracking ID:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase">{kid.vehicleDetails.trackingId}</span>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(kid.vehicleDetails!.trackingId);
                                    toast.success('Tracking ID copied to clipboard');
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Copy Tracking ID"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Driver:</span>
                            <span className="font-bold text-gray-900 dark:text-white">{kid.vehicleDetails.driverName}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Phone:</span>
                            <a href={`tel:${kid.vehicleDetails.driverPhone}`} className="text-primary hover:underline font-bold">
                              {kid.vehicleDetails.driverPhone}
                            </a>
                          </div>
                          <div className="flex justify-between items-center text-sm border-t border-gray-200 dark:border-gray-700 pt-3">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Termly Fee:</span>
                            <span className="font-black text-gray-900 dark:text-white text-lg">{school?.currency} {kid.routeDetails.termlyFee.toLocaleString()}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setTrackingVehicle({ vehicle: kid.vehicleDetails!, route: kid.routeDetails! })}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl font-bold transition-colors"
                        >
                          <Navigation className="w-5 h-5" />
                          Track Live Location
                        </button>

                        {kid.routeDetails.stops && kid.routeDetails.stops.length > 0 && (
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                              <Navigation className="w-4 h-4" /> Route Schedule
                            </h3>
                            <div className="space-y-2 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                              {kid.routeDetails.stops.map((stop, i) => (
                                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                  <div className="flex items-center justify-center w-5 h-5 rounded-full border-4 border-white dark:border-gray-900 bg-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                                  <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      {stop.name}
                                    </span>
                                    <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                                      {stop.time}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-500 rounded-2xl text-sm font-medium">
                        Transport details are incomplete or the route/vehicle assigned has been deleted by the school.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {kidsWithoutTransport.length > 0 && (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Not Subscribed to Transport</h3>
                <div className="space-y-4">
                  {kidsWithoutTransport.map(kid => (
                    <div key={kid.id} className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-800 rounded-2xl">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{kid.fullName}</h4>
                        <p className="text-xs text-gray-500 font-medium">Admission: {kid.admissionNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                  <p className="text-sm text-blue-800 dark:text-blue-400 font-medium text-center">
                    To inquire about school transport options, please contact the school administration.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <WazeTrackerModal 
        vehicle={trackingVehicle?.vehicle || null} 
        route={trackingVehicle?.route || null} 
        onClose={() => setTrackingVehicle(null)} 
      />
    </ParentLayout>
  );
}
