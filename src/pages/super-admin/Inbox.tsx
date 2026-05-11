import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Search, 
  Trash2, 
  Archive, 
  RefreshCcw, 
  MoreVertical, 
  Clock, 
  User,
  CheckCircle2,
  X,
  Reply,
  Loader2,
  Plus,
  Paperclip,
  Download
} from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { SystemEmail, School } from '../../types';
import { toast } from 'sonner';

export default function Inbox() {
  const [emails, setEmails] = useState<SystemEmail[]>([]);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<SystemEmail | null>(null);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachment, setReplyAttachment] = useState<{ name: string, data: string } | null>(null);
  const [composeData, setComposeData] = useState({ schoolId: '', subject: '', message: '', attachment: null as { name: string, data: string } | null });
  const [isSending, setIsSending] = useState(false);
  const [systemBranding, setSystemBranding] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'system_emails'),
      where('type', '==', activeTab),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emailData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemEmail));
      setEmails(emailData);
      setLoading(false);
    });

    const unsubscribeUnread = onSnapshot(
      query(collection(db, 'system_emails'), where('type', '==', 'incoming'), where('read', '==', false)),
      (snapshot) => setUnreadCount(snapshot.size)
    );

    onSnapshot(doc(db, 'settings', 'system'), (snapshot) => {
      if (snapshot.exists()) setSystemBranding(snapshot.data());
    });

    // Fetch schools for compose
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School)));
    });

    return () => {
      unsubscribe();
      unsubscribeUnread();
      unsubSchools();
    };
  }, [activeTab]);

  const handleMarkAsRead = async (email: SystemEmail) => {
    if (email.read) return;
    try {
      await updateDoc(doc(db, 'system_emails', email.id), { read: true });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'system_emails', id));
      toast.success('Message deleted');
      if (selectedEmail?.id === id) setSelectedEmail(null);
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleReply = async () => {
    if (!selectedEmail || !replyMessage) return;

    setIsSending(true);
    try {
      // 1. Save to Outbox (system_emails collection with type 'outgoing')
      const outgoingEmail: any = {
        from: 'support@edumanagepro.com',
        to: selectedEmail.from,
        subject: `Re: ${selectedEmail.subject}`,
        message: replyMessage,
        type: 'outgoing',
        status: 'sent',
        read: true,
        createdAt: new Date().toISOString(),
        recipientName: selectedEmail.senderName || selectedEmail.from,
        attachment: replyAttachment
      };

      if (selectedEmail.schoolId) {
        outgoingEmail.schoolId = selectedEmail.schoolId;
      }

      await addDoc(collection(db, 'system_emails'), outgoingEmail);

      // 2. Deliver to School's Inbox if schoolId is present
      if (selectedEmail.schoolId) {
        await addDoc(collection(db, 'schools', selectedEmail.schoolId, 'inbox'), {
          type: 'alert',
          title: `Re: ${selectedEmail.subject}`,
          message: replyMessage,
          date: new Date().toISOString(),
          status: 'unread',
          attachment: replyAttachment
        });
      }

      toast.success('Reply sent successfully');
      setIsReplyModalOpen(false);
      setReplyMessage('');
      setReplyAttachment(null);
    } catch (error) {
      console.error('Error replying:', error);
      toast.error('Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleCompose = async () => {
    if (!composeData.schoolId || !composeData.subject || !composeData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSending(true);
    try {
      const targetSchool = schools.find(s => s.id === composeData.schoolId);
      const now = new Date().toISOString();
      
      // 1. Save to Outbox
      await addDoc(collection(db, 'system_emails'), {
        from: 'support@edumanagepro.com',
        to: targetSchool?.email || 'school@system.com',
        subject: composeData.subject,
        message: composeData.message,
        type: 'outgoing',
        status: 'sent',
        read: true,
        createdAt: now,
        recipientName: targetSchool?.name || 'School',
        schoolId: composeData.schoolId,
        attachment: composeData.attachment
      });

      // 2. Deliver to School's Inbox
      await addDoc(collection(db, 'schools', composeData.schoolId, 'inbox'), {
        type: 'alert',
        title: composeData.subject,
        message: composeData.message,
        date: now,
        status: 'unread',
        attachment: composeData.attachment
      });

      toast.success('Message sent to school');
      setIsComposeModalOpen(false);
      setComposeData({ schoolId: '', subject: '', message: '', attachment: null });
    } catch (error) {
      console.error('Error composing:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'reply' | 'compose') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachment = {
          name: file.name,
          data: reader.result as string
        };
        if (type === 'reply') {
          setReplyAttachment(attachment);
        } else {
          setComposeData({ ...composeData, attachment });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredEmails = emails.filter(email => 
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (email.senderName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6">
      <div className="bg-school-gradient p-4 md:p-6 rounded-[2.5rem] shadow-lg shadow-maroon/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-black text-white">Communications</h1>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-red-500/40">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <p className="text-sm text-white/80 font-medium tracking-wide">Manage incoming and outgoing messages across the system.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsComposeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-black/10"
            >
              <Plus className="h-4 w-4" />
              New Message
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
            <button 
              onClick={() => setLoading(true)} 
              className="p-2 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-xl transition-all text-white"
              title="Refresh"
            >
              <RefreshCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'incoming'
                ? 'bg-white text-primary shadow-lg shadow-black/10'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === 'outgoing'
                ? 'bg-white text-primary shadow-lg shadow-black/10'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            Sent
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 md:gap-6 min-h-0 overflow-hidden">
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
                  <Mail className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No messages found</p>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <div 
                  key={email.id}
                  onClick={() => {
                    setSelectedEmail(email);
                    handleMarkAsRead(email);
                  }}
                  className={`p-4 cursor-pointer transition-all hover:bg-gray-50 relative group ${
                    selectedEmail?.id === email.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'
                  } ${!email.read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-1">
                    <span className={`text-sm ${!email.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                      {activeTab === 'outgoing' ? `To: ${email.recipientName || email.to}` : (email.senderName || email.from.split('@')[0])}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {new Date(email.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(email.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <h3 className={`text-xs truncate mb-1 ${!email.read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                    {email.subject}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {email.message}
                  </p>
                  {!email.read && (
                    <div className="absolute right-4 bottom-4 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {selectedEmail ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-bold text-xl">
                    {(selectedEmail.senderName || selectedEmail.from)[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedEmail.subject}</h2>
                    <p className="text-sm text-gray-500">
                      {activeTab === 'outgoing' ? 'To: ' : 'From: '}
                      <span className="font-bold">{activeTab === 'outgoing' ? selectedEmail.recipientName : selectedEmail.senderName}</span> 
                      ({activeTab === 'outgoing' ? selectedEmail.to : selectedEmail.from})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeTab === 'incoming' && (
                    <button 
                      onClick={() => setIsReplyModalOpen(true)}
                      className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                      title="Reply"
                    >
                      <Reply className="h-5 w-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(selectedEmail.id)}
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
                  <Clock className="h-4 w-4" />
                  Received on {new Date(selectedEmail.createdAt).toLocaleString()}
                </div>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedEmail.message}
                </div>
                {selectedEmail.attachment && (
                  <div className="mt-8 pt-8 border-t border-gray-50">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Attachment</p>
                    <a 
                      href={selectedEmail.attachment.data} 
                      download={selectedEmail.attachment.name}
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all group"
                    >
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                        <Paperclip className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{selectedEmail.attachment.name}</p>
                        <p className="text-[10px] text-gray-500">Click to download</p>
                      </div>
                      <Download className="h-4 w-4 text-gray-400" />
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/50">
                <button 
                  onClick={() => setIsReplyModalOpen(true)}
                  className="w-full py-4 bg-white border border-gray-200 rounded-2xl text-gray-500 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                  <Reply className="h-5 w-5" />
                  Click here to reply
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <Mail className="h-12 w-12 text-gray-200" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Select a message</h2>
              <p className="text-gray-500 max-w-xs mx-auto">Choose a message from the list on the left to read its content.</p>
            </div>
          )}
        </div>
      </div>

      {/* Reply Modal */}
      {isReplyModalOpen && selectedEmail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-[calc(100%-2rem)] md:w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Reply to Message</h2>
                <p className="text-gray-500 font-medium">To: {selectedEmail.senderName} ({selectedEmail.from})</p>
              </div>
              <button onClick={() => setIsReplyModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-4 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Subject</label>
                <input 
                  type="text"
                  value={`Re: ${selectedEmail.subject}`}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl outline-none text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Message</label>
                <textarea 
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary h-48 resize-none"
                  placeholder="Type your reply here..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Attachment (Optional)</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 border-dashed rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                    <Paperclip className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium truncate">
                      {replyAttachment ? replyAttachment.name : 'Choose a file...'}
                    </span>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => handleFileChange(e, 'reply')}
                    />
                  </label>
                  {replyAttachment && (
                    <button 
                      onClick={() => setReplyAttachment(null)}
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
                  onClick={() => setIsReplyModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleReply}
                  disabled={isSending || !replyMessage}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Reply className="h-5 w-5" />}
                  Send Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Compose Modal */}
      {isComposeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-[calc(100%-2rem)] md:w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 bg-gray-50/50">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">New Message</h2>
                <p className="text-gray-500 font-medium">Send a new message to a school</p>
              </div>
              <button onClick={() => setIsComposeModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="p-4 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Select School</label>
                <select 
                  value={composeData.schoolId}
                  onChange={(e) => setComposeData({ ...composeData, schoolId: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary"
                >
                  <option value="">Select a school...</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
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
                      onChange={(e) => handleFileChange(e, 'compose')}
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
                  disabled={isSending || !composeData.schoolId || !composeData.subject || !composeData.message}
                  className="flex-1 py-4 bg-school-gradient text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
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
