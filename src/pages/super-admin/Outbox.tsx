import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Search, 
  Trash2, 
  RefreshCcw, 
  Clock, 
  User,
  CheckCircle2,
  X,
  Loader2,
  Mail
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { SystemEmail } from '../../types';
import { toast } from 'sonner';

export default function Outbox() {
  const [emails, setEmails] = useState<SystemEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<SystemEmail | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'system_emails'),
      where('type', '==', 'outgoing'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emailData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemEmail));
      setEmails(emailData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sent message record?')) return;
    try {
      await deleteDoc(doc(db, 'system_emails', id));
      toast.success('Sent message record deleted');
      if (selectedEmail?.id === id) setSelectedEmail(null);
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const filteredEmails = emails.filter(email => 
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (email.recipientName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Outbox</h1>
            <p className="text-sm text-white/80 font-medium tracking-wide">View history of messages sent from the system.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search sent messages..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setLoading(true)} 
              className="p-2 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-xl transition-all text-white"
              title="Refresh"
            >
              <RefreshCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Email List */}
        <div className="w-1/3 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Send className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No sent messages found</p>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <div 
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 relative ${
                    selectedEmail?.id === email.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700">
                      To: {email.recipientName || email.to.split('@')[0]}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {new Date(email.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xs truncate mb-1 font-bold text-gray-900">
                    {email.subject}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {email.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {selectedEmail ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 font-bold text-xl">
                    {(selectedEmail.recipientName || selectedEmail.to)[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedEmail.subject}</h2>
                    <p className="text-sm text-gray-500">To: <span className="font-bold">{selectedEmail.recipientName}</span> ({selectedEmail.to})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDelete(selectedEmail.id)}
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
                  <Clock className="h-4 w-4" />
                  Sent on {new Date(selectedEmail.createdAt).toLocaleString()}
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedEmail.message}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-bold">Successfully Sent</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">From: support@edumanagepro.com</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <Send className="h-12 w-12 text-gray-200" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Select a sent message</h2>
              <p className="text-gray-500 max-w-xs mx-auto">Choose a message from the list on the left to view its details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
