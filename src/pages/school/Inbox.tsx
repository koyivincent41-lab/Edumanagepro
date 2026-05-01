import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  Filter, 
  FileText, 
  Receipt, 
  Download, 
  Eye, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Inbox as InboxIcon,
  Printer,
  X,
  Send,
  Plus,
  Paperclip,
  Trash2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { School } from '../../types';
import { toast } from 'sonner';
import { getExchangeRates, SUPPORTED_CURRENCIES } from '../../services/currencyService';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useCallback } from 'react';

interface SystemNotification {
  id: string;
  type: 'invoice' | 'receipt' | 'alert' | 'message';
  title: string;
  message: string;
  amount?: number;
  date: string;
  status: 'unread' | 'read';
  documentId?: string; // Reference to the actual invoice/receipt record if needed
  content?: any; // Full document content for generation
  recipientName?: string;
  attachment?: { name: string, data: string } | null;
}

export default function Inbox({ school, defaultTab = 'inbox' }: { school: School | null, defaultTab?: 'inbox' | 'sent' }) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [sentMessages, setSentMessages] = useState<SystemNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>(defaultTab);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'invoice' | 'receipt'>('all');
  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [composeData, setComposeData] = useState({ subject: '', message: '', attachment: null as { name: string, data: string } | null });
  const [isSending, setIsSending] = useState(false);
  const [systemBranding, setSystemBranding] = useState<any>(null);
  const [rates, setRates] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pendingDownload, setPendingDownload] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab);
    setSelectedNotification(null);
  }, [defaultTab]);

  const handleDownload = useCallback(async () => {
    if (!selectedNotification) return;
    
    const element = document.getElementById('printable-document');
    if (!element) return;

    setIsDownloading(true);
    const toastId = toast.loading('Generating PDF...');

    try {
      // Ensure images are loaded and CORS is handled
      // Scroll to top to avoid clipping issues
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);
      
      // Small delay to ensure rendering is stable
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        style: {
          margin: '0',
          padding: '40px',
          boxShadow: 'none',
          border: 'none',
          maxHeight: 'none',
          overflow: 'visible'
        }
      });
      
      // Restore scroll
      window.scrollTo(0, originalScrollY);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [element.offsetWidth, element.offsetHeight]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth, element.offsetHeight);
      pdf.save(`${selectedNotification.type}-${selectedNotification.content?.number || selectedNotification.id}.pdf`);
      
      toast.success('PDF downloaded successfully', { id: toastId });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  }, [selectedNotification]);

  useEffect(() => {
    if (pendingDownload && selectedNotification) {
      const element = document.getElementById('printable-document');
      if (element) {
        handleDownload();
        setPendingDownload(false);
      }
    }
  }, [pendingDownload, selectedNotification, handleDownload]);

  useEffect(() => {
    if (!school?.id) return;

    const unsubscribeInbox = onSnapshot(
      query(collection(db, 'schools', school.id, 'inbox'), orderBy('date', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemNotification));
        setNotifications(data);
        setLoading(false);
      },
      (error) => {
        console.error("Inbox listener error:", error);
        setLoading(false);
      }
    );

    const unsubscribeSent = onSnapshot(
      query(collection(db, 'schools', school.id, 'sent'), orderBy('date', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemNotification));
        setSentMessages(data);
      }
    );

    // Fetch system branding for invoice/receipt headers
    getDoc(doc(db, 'settings', 'system')).then(snap => {
      if (snap.exists()) setSystemBranding(snap.data());
    });

    // Fetch exchange rates for dynamic conversion
    getExchangeRates().then(setRates);

    return () => {
      unsubscribeInbox();
      unsubscribeSent();
    };
  }, [school?.id]);

  const handleCompose = async () => {
    if (!school || !composeData.subject || !composeData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSending(true);
    try {
      const now = new Date().toISOString();
      const messageData = {
        type: 'message',
        title: composeData.subject,
        message: composeData.message,
        date: now,
        status: 'read',
        recipientName: 'Super Admin',
        attachment: composeData.attachment
      };
      
      // 1. Save to School's Sent collection
      await addDoc(collection(db, 'schools', school.id, 'sent'), messageData);

      // 2. Deliver to Super Admin's Inbox (system_emails)
      await addDoc(collection(db, 'system_emails'), {
        from: school.email,
        to: 'support@edumanagepro.com',
        subject: composeData.subject,
        message: composeData.message,
        type: 'incoming',
        status: 'received',
        read: false,
        createdAt: now,
        senderName: school.name,
        schoolId: school.id,
        attachment: composeData.attachment
      });

      toast.success('Message sent to Super Admin');
      setIsComposeModalOpen(false);
      setComposeData({ subject: '', message: '', attachment: null });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!school?.id) return;

    try {
      const collectionName = activeTab === 'inbox' ? 'inbox' : 'sent';
      await deleteDoc(doc(db, 'schools', school.id, collectionName, id));
      toast.success('Message deleted');
      if (selectedNotification?.id === id) setSelectedNotification(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setComposeData({
          ...composeData,
          attachment: {
            name: file.name,
            data: reader.result as string
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const getConvertedAmount = (amount: number, sourceCurrency: string) => {
    if (!rates || !school?.currency) return amount;
    const targetCurrency = school.currency;
    if (sourceCurrency === targetCurrency) return amount;

    const sourceRate = rates[sourceCurrency] || 1;
    const targetRate = rates[targetCurrency] || 1;
    
    // Convert to USD first, then to target
    const usdAmount = amount / sourceRate;
    return usdAmount * targetRate;
  };

  const formatAmount = (amount: number, currencyCode: string) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(currencyCode) ? 0 : 2,
      maximumFractionDigits: ['KES', 'UGX', 'TZS', 'RWF'].includes(currencyCode) ? 0 : 2
    });
  };

  const markAsRead = async (id: string) => {
    if (!school?.id) return;
    try {
      await updateDoc(doc(db, 'schools', school.id, 'inbox', id), { status: 'read' });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const filteredNotifications = (activeTab === 'inbox' ? notifications : sentMessages).filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         n.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && n.status === 'unread') ||
                         (filter === 'invoice' && n.type === 'invoice') ||
                         (filter === 'receipt' && n.type === 'receipt');
    return matchesSearch && matchesFilter;
  });

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-school-gradient p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-white">School {activeTab === 'inbox' ? 'Inbox' : 'Outbox'}</h1>
                {notifications.filter(n => n.status === 'unread').length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-red-500/40">
                    {notifications.filter(n => n.status === 'unread').length} New
                  </span>
                )}
              </div>
              <p className="text-sm text-white/80 font-medium tracking-wide">
                {activeTab === 'inbox' 
                  ? 'System notifications, invoices, and payment receipts.' 
                  : 'Messages sent to the system administration.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setIsComposeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-black/10"
            >
              <Plus className="h-4 w-4" />
              Compose
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Search messages..."
                className="pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:bg-white/20 outline-none w-64 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white focus:bg-white/20 outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all" className="text-gray-900">All Messages</option>
              <option value="unread" className="text-gray-900">Unread</option>
              <option value="invoice" className="text-gray-900">Invoices</option>
              <option value="receipt" className="text-gray-900">Receipts</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Message List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab('inbox'); setSelectedNotification(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all relative ${activeTab === 'inbox' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <InboxIcon className="h-4 w-4" />
              Inbox
              {notifications.filter(n => n.status === 'unread').length > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm shadow-red-500/40">
                  {notifications.filter(n => n.status === 'unread').length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('sent'); setSelectedNotification(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all ${activeTab === 'sent' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Send className="h-4 w-4" />
              Sent
            </button>
          </div>
          
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-12 text-center border border-dashed border-gray-200">
              {activeTab === 'inbox' ? <InboxIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" /> : <Send className="h-12 w-12 text-gray-300 mx-auto mb-4" />}
              <p className="text-gray-500 font-medium">No {activeTab === 'inbox' ? 'messages' : 'sent messages'} found</p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  setSelectedNotification(n);
                  if (n.status === 'unread') markAsRead(n.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedNotification(n);
                    if (n.status === 'unread') markAsRead(n.id);
                  }
                }}
                className={`w-full text-left p-4 rounded-2xl border transition-all group cursor-pointer ${
                  selectedNotification?.id === n.id 
                    ? 'bg-school-gradient text-white border-transparent shadow-lg shadow-primary/20' 
                    : 'bg-white border-gray-100 hover:border-primary/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    selectedNotification?.id === n.id ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-primary/5'
                  }`}>
                    {n.type === 'invoice' ? <FileText className="h-5 w-5" /> : 
                     n.type === 'receipt' ? <Receipt className="h-5 w-5" /> : 
                     <AlertCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        selectedNotification?.id === n.id ? 'text-white/70' : 'text-gray-400'
                      }`}>
                        {activeTab === 'sent' ? `To: ${n.recipientName}` : n.type}
                      </span>
                      {n.status === 'unread' && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold truncate mb-1">{n.title}</h3>
                    <p className={`text-xs truncate ${
                      selectedNotification?.id === n.id ? 'text-white/80' : 'text-gray-500'
                    }`}>
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${
                          selectedNotification?.id === n.id ? 'text-white/60' : 'text-gray-400'
                        }`}>
                          {new Date(n.date).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n.id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            selectedNotification?.id === n.id 
                              ? 'hover:bg-white/20 text-white' 
                              : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                          }`}
                          title="Delete Message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedNotification?.id === n.id) {
                              handleDownload();
                            } else {
                              setSelectedNotification(n);
                              setPendingDownload(true);
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            selectedNotification?.id === n.id 
                              ? 'hover:bg-white/20 text-white' 
                              : 'hover:bg-primary/5 text-gray-400 hover:text-primary'
                          }`}
                          title="Quick Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {n.amount && (
                        <span className={`text-xs font-black ${
                          selectedNotification?.id === n.id ? 'text-white' : 'text-primary'
                        }`}>
                          {school?.currency || 'UGX'} {formatAmount(getConvertedAmount(n.amount, n.content?.currency || 'UGX'), school?.currency || 'UGX')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message Detail / Document Viewer */}
        <div className="lg:col-span-2">
          {selectedNotification ? (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden sticky top-8">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedNotification(null)}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="h-5 w-5 text-gray-400" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedNotification.title}</h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {activeTab === 'inbox' ? 'Received on' : 'Sent on'} {new Date(selectedNotification.date).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <button 
                    onClick={() => handleDelete(selectedNotification.id)}
                    className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete Message"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  {selectedNotification.type !== 'message' && selectedNotification.type !== 'alert' && (
                    <>
                      <button 
                        onClick={handlePrint}
                        className="p-2.5 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                        title="Print"
                      >
                        <Printer className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="p-2.5 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all disabled:opacity-50"
                        title="Download PDF"
                      >
                        {isDownloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-8 overflow-y-auto max-h-[calc(100vh-250px)]">
                {selectedNotification.type === 'message' || selectedNotification.type === 'alert' ? (
                  <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm max-w-2xl mx-auto">
                    <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-50">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</p>
                        <h3 className="text-lg font-bold text-gray-900">{selectedNotification.title}</h3>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {selectedNotification.message}
                    </div>
                    {selectedNotification.attachment && (
                      <div className="mt-8 pt-8 border-t border-gray-50">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Attachment</p>
                        <a 
                          href={selectedNotification.attachment.data} 
                          download={selectedNotification.attachment.name}
                          className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all group"
                        >
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                            <Paperclip className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{selectedNotification.attachment.name}</p>
                            <p className="text-[10px] text-gray-500">Click to download</p>
                          </div>
                          <Download className="h-4 w-4 text-gray-400" />
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Document Preview (Invoice/Receipt) */
                  <div id="printable-document" className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm max-w-2xl mx-auto">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      {systemBranding?.companyLogo ? (
                        <img 
                          src={systemBranding.companyLogo} 
                          alt="Logo" 
                          className="h-16 object-contain mb-4" 
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-school-gradient rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4">
                          E
                        </div>
                      )}
                      <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">{systemBranding?.companyName || 'EduManagePro'}</h1>
                      <div className="text-xs text-gray-500 font-medium space-y-1 mt-2">
                        <p>{systemBranding?.companyAddress}</p>
                        <p>{systemBranding?.companyPhone}</p>
                        <p>{systemBranding?.contactEmail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h2 className={`text-4xl font-black uppercase italic tracking-tighter ${
                        selectedNotification.type === 'invoice' ? 'text-primary' : 'text-green-600'
                      }`}>
                        {selectedNotification.type}
                      </h2>
                      <div className="mt-4 space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Number</p>
                        <p className="text-lg font-black text-gray-900">#{selectedNotification.content?.number || 'N/A'}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Date</p>
                        <p className="text-sm font-bold text-gray-900">{new Date(selectedNotification.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Billing Info */}
                  <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Bill To</p>
                      <h3 className="text-lg font-bold text-gray-900">{school?.name}</h3>
                      <div className="text-xs text-gray-500 font-medium space-y-1 mt-1">
                        <p>{school?.address}</p>
                        <p>{school?.phone}</p>
                        <p>{school?.email}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</p>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedNotification.type === 'invoice' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {selectedNotification.type === 'invoice' ? 'Pending Payment' : 'Paid & Confirmed'}
                      </span>
                      {selectedNotification.content?.paymentMethod && (
                        <div className="mt-4">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Method</p>
                          <p className="text-sm font-bold text-gray-900">{selectedNotification.content.paymentMethod}</p>
                        </div>
                      )}
                      {selectedNotification.content?.transactionCode && (
                        <div className="mt-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Transaction Code</p>
                          <p className="text-sm font-bold text-gray-900">{selectedNotification.content.transactionCode}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full mb-12">
                    <thead>
                      <tr className="border-b-2 border-gray-900">
                        <th className="py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                        <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-6">
                          <p className="text-sm font-bold text-gray-900">{selectedNotification.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{selectedNotification.message}</p>
                        </td>
                        <td className="py-6 text-right font-black text-gray-900">
                          {school?.currency || 'UGX'} {formatAmount(getConvertedAmount(selectedNotification.amount || 0, selectedNotification.content?.currency || 'UGX'), school?.currency || 'UGX')}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-900">
                        <td className="py-6 text-right text-sm font-bold text-gray-500 uppercase tracking-widest">Total Amount</td>
                        <td className="py-6 text-right text-xl font-black text-primary">
                          {school?.currency || 'UGX'} {formatAmount(getConvertedAmount(selectedNotification.amount || 0, selectedNotification.content?.currency || 'UGX'), school?.currency || 'UGX')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Footer */}
                  <div className="flex justify-between items-end">
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 max-w-xs">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Note</p>
                        <p className="text-[10px] text-gray-600 leading-relaxed italic">
                          This is a system-generated document. For any queries, contact our support team at {systemBranding?.contactEmail}.
                        </p>
                      </div>
                    </div>
                    <div className="text-center relative">
                      {/* Company Seal */}
                      <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-32 h-32 border-4 rounded-full flex flex-col items-center justify-center rotate-[-15deg] opacity-70 pointer-events-none select-none ${
                        selectedNotification.type === 'receipt' ? 'border-green-600/40 text-green-700' : 'border-red-600/40 text-red-700'
                      }`}>
                        <p className="text-[8px] font-black uppercase tracking-tighter leading-none mb-1">{systemBranding?.companyName || 'Edumanagepro'}</p>
                        <div className={`w-20 h-px my-1 ${selectedNotification.type === 'receipt' ? 'bg-green-600/30' : 'bg-red-600/30'}`} />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none my-1">
                          {selectedNotification.type === 'receipt' ? 'PAID' : 'NOT PAID'}
                        </p>
                        <div className={`w-20 h-px my-1 ${selectedNotification.type === 'receipt' ? 'bg-green-600/30' : 'bg-red-600/30'}`} />
                        <p className="text-[7px] font-bold tracking-tighter leading-none">#{selectedNotification.content?.number || 'N/A'}</p>
                        <p className="text-[6px] font-medium tracking-tighter leading-none mt-1">
                          {new Date(selectedNotification.date).toLocaleDateString()} {new Date(selectedNotification.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[7px] font-black tracking-tighter leading-none mt-1">{systemBranding?.companyPhone || '0729934770'}</p>
                        <div className={`absolute inset-0 border-2 rounded-full scale-90 ${selectedNotification.type === 'receipt' ? 'border-green-600/20' : 'border-red-600/20'}`} />
                      </div>

                      {systemBranding?.companySignature && (
                        <img 
                          src={systemBranding.companySignature} 
                          alt="Signature" 
                          className="h-12 object-contain mx-auto mb-2 relative z-10" 
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="w-32 h-px bg-gray-200 mx-auto mb-2 relative z-10" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest relative z-10">Authorized Signature</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-12 text-center flex flex-col items-center justify-center h-[calc(100vh-250px)]">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <InboxIcon className="h-10 w-10 text-gray-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Select a {activeTab === 'inbox' ? 'message' : 'sent message'}</h2>
              <p className="text-gray-500 max-w-xs mx-auto">
                {activeTab === 'inbox' 
                  ? 'Choose a notification from the list to view its details and documents.' 
                  : 'Choose a sent message from the list to view its content.'}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Compose Modal */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Compose Message</h2>
                <p className="text-gray-500 font-medium">Send a message to Super Admin</p>
              </div>
              <button onClick={() => setIsComposeModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">To</label>
                <input 
                  type="text"
                  value="Super Admin"
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl outline-none text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Subject</label>
                <input 
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                  placeholder="Enter subject..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Message</label>
                <textarea 
                  value={composeData.message}
                  onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary h-48 resize-none"
                  placeholder="Type your message here..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Attachment (Optional)</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 border-dashed rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                    <Paperclip className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium truncate">
                      {composeData.attachment ? composeData.attachment.name : 'Choose a file...'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </label>
                  {composeData.attachment && (
                    <button 
                      onClick={() => setComposeData({ ...composeData, attachment: null })}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-2 italic">Max file size: 2MB</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsComposeModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCompose}
                  disabled={isSending || !composeData.subject || !composeData.message}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
