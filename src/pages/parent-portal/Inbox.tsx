import React, { useState, useEffect } from 'react';
import ParentLayout from '../../components/ParentLayout';
import { UserProfile, Notification } from '../../types';
import { Bell, Loader2, CheckCircle2, XCircle, Info, Trash2, FileText, Receipt } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';

export default function Inbox({ profile }: { profile: UserProfile }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile.schoolId) return;

    const fetchNotifications = async () => {
      try {
        const parentsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'parents'), 
          where('uid', '==', profile.uid)
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        
        let parentId = '';
        if (!parentsSnapshot.empty) {
          parentId = parentsSnapshot.docs[0].id;
        } else {
          // Check if profile.uid is actually the parent document ID (from localStorage login)
          const parentDoc = await getDoc(doc(db, 'schools', profile.schoolId!, 'parents', profile.uid));
          if (parentDoc.exists()) {
            parentId = parentDoc.id;
          }
        }

        if (!parentId) {
          setLoading(false);
          return null;
        }

        const notificationsQuery = query(
          collection(db, 'schools', profile.schoolId!, 'notifications'),
          where('parentId', '==', parentId),
          orderBy('createdAt', 'desc')
        );

        return onSnapshot(notificationsQuery, (snapshot) => {
          setNotifications(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Notification[]);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching notifications:", error);
        setLoading(false);
        return null;
      }
    };

    let unsub: any;
    fetchNotifications().then(u => { unsub = u; });

    return () => {
      if (unsub) unsub();
    };
  }, [profile]);

  const markAsRead = async (id: string) => {
    if (!profile.schoolId) return;
    try {
      await updateDoc(doc(db, 'schools', profile.schoolId, 'notifications', id), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!profile.schoolId) return;
    try {
      await deleteDoc(doc(db, 'schools', profile.schoolId, 'notifications', id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment_approved':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'payment_declined':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'new_invoice':
        return <FileText className="h-5 w-5 text-purple-500" />;
      case 'new_receipt':
        return <Receipt className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <ParentLayout profile={profile}>
      <div className="mb-8">
        <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">Inbox</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your notifications and messages from the school.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-12 text-center">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Bell className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No notifications yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">When the school sends you a message or updates your payment status, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              onClick={() => !notification.read && markAsRead(notification.id)}
              className={`bg-white dark:bg-gray-900 p-6 rounded-3xl border transition-all cursor-pointer group ${
                notification.read 
                  ? 'border-gray-100 dark:border-gray-800 opacity-75' 
                  : 'border-primary/20 bg-primary/5 shadow-lg shadow-primary/5'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl ${
                  notification.type === 'payment_approved' || notification.type === 'new_receipt' ? 'bg-green-50 dark:bg-green-900/20' :
                  notification.type === 'payment_declined' ? 'bg-red-50 dark:bg-red-900/20' :
                  notification.type === 'new_invoice' ? 'bg-purple-50 dark:bg-purple-900/20' :
                  'bg-blue-50 dark:bg-blue-900/20'
                }`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-1">
                    <h3 className={`font-bold truncate ${notification.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {notification.message}
                  </p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ParentLayout>
  );
}
