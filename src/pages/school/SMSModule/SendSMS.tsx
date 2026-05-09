import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { Parent, ParentStudentLink, Student, Class, SMSTemplate } from '../../../types';
import { Send, Users, User, LayoutGrid, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function SendSMS({ schoolId }: { schoolId: string }) {
  const [parents, setParents] = useState<Parent[]>([]);
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [sendType, setSendType] = useState<'all' | 'class' | 'individual'>('all');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubParents = onSnapshot(query(collection(db, 'schools', schoolId, 'parents')), snap => {
      setParents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Parent)));
    });
    const unsubLinks = onSnapshot(query(collection(db, 'schools', schoolId, 'parentStudentLinks')), snap => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ParentStudentLink)));
    });
    const unsubStudents = onSnapshot(query(collection(db, 'schools', schoolId, 'students')), snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    });
    const unsubClasses = onSnapshot(query(collection(db, 'schools', schoolId, 'classes')), snap => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });
    const unsubTemplates = onSnapshot(query(collection(db, 'schools', schoolId, 'smsTemplates')), snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SMSTemplate)));
      setLoading(false);
    });

    return () => {
      unsubParents();
      unsubLinks();
      unsubStudents();
      unsubClasses();
      unsubTemplates();
    };
  }, [schoolId]);

  const targetParents = useMemo(() => {
    if (sendType === 'all') return parents;
    if (sendType === 'individual') {
      return parents.filter(p => p.id === selectedParentId);
    }
    if (sendType === 'class') {
      const classStudentIds = new Set(students.filter(s => s.classId === selectedClassId).map(s => s.id));
      const classParentIds = new Set(links.filter(l => classStudentIds.has(l.studentId)).map(l => l.parentId));
      return parents.filter(p => classParentIds.has(p.id));
    }
    return [];
  }, [sendType, parents, selectedClassId, selectedParentId, students, links]);

  // Clean phone numbers: AT usually requires +[CountryCode]. Ensure valid format (simplistic approach here assuming intl format)
  const formatPhoneNumber = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    // If it starts with 0 e.g. 07... replace with +254 (assuming Kenya default for AT, but you might want to configure this)
    // Here we'll just ensure it has a + if it looks like country code, else we leave it for AT to fail or format.
    // For safety, we just add + if they included country code without it.
    if (!clean.startsWith('254') && clean.length === 10 && clean.startsWith('0')) {
        clean = '254' + clean.slice(1);
    }
    if (!clean.startsWith('+')) {
      clean = '+' + clean;
    }
    return clean;
  };

  const selectedNumbers = useMemo(() => {
    return targetParents
      .map(p => p.phone)
      .filter(Boolean)
      .map(formatPhoneNumber);
  }, [targetParents]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tid = e.target.value;
    setSelectedTemplateId(tid);
    if (tid) {
      const template = templates.find(t => t.id === tid);
      if (template) setMessage(template.content);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    if (selectedNumbers.length === 0) {
      toast.error('No valid phone numbers found for the selected target');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedNumbers,
          message: message.trim()
        })
      });
      
      const data = await res.json();

      let status: 'sent' | 'failed' | 'pending' = 'sent';
      if (!res.ok) {
        status = 'failed';
        toast.error(data.error || 'Failed to send SMS');
      } else {
        toast.success(`SMS queued for ${selectedNumbers.length} recipient(s)`);
      }

      // Log to history
      await addDoc(collection(db, 'schools', schoolId, 'smsMessages'), {
        schoolId,
        sentBy: auth.currentUser?.uid || 'Unknown',
        senderName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        recipientsCount: selectedNumbers.length,
        content: message.trim(),
        status,
        deliveryReport: data,
        createdAt: new Date().toISOString()
      });

      if (res.ok) {
        setMessage('');
        setSelectedTemplateId('');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while sending SMS');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setSendType('all')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            sendType === 'all' 
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className={`p-2 w-max rounded-xl mb-3 ${sendType === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900">All Parents</h3>
          <p className="text-xs text-gray-500 mt-1">Send to everyone</p>
        </button>

        <button
          onClick={() => setSendType('class')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            sendType === 'class' 
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className={`p-2 w-max rounded-xl mb-3 ${sendType === 'class' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
            <LayoutGrid className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900">By Class</h3>
          <p className="text-xs text-gray-500 mt-1">Target specific classes</p>
        </button>

        <button
          onClick={() => setSendType('individual')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            sendType === 'individual' 
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className={`p-2 w-max rounded-xl mb-3 ${sendType === 'individual' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
            <User className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900">Individual</h3>
          <p className="text-xs text-gray-500 mt-1">Send to a specific parent</p>
        </button>
      </div>

      <form onSubmit={handleSend} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
        
        {sendType === 'class' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Class</label>
            <select 
              required
              value={selectedClassId} 
              onChange={e => setSelectedClassId(e.target.value)} 
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary"
            >
              <option value="">Choose a class...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {sendType === 'individual' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Parent</label>
            <select 
              required
              value={selectedParentId} 
              onChange={e => setSelectedParentId(e.target.value)} 
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-primary"
            >
              <option value="">Choose a parent...</option>
              {parents.map(p => (
                <option key={p.id} value={p.id}>{p.fullName} ({p.phone || 'No phone'})</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-semibold text-gray-700">Message</label>
            {templates.length > 0 && (
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                className="text-sm p-1.5 border border-gray-200 rounded-lg outline-none focus:border-primary text-gray-600"
              >
                <option value="">Use a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
          </div>
          <textarea 
            required 
            rows={5} 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-primary resize-none" 
            placeholder="Type your message here..." 
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">
              {message.length} characters (approx. {Math.ceil(message.length / 160)} SMS)
            </p>
            <p className="text-xs font-semibold text-primary">
              Targeting {selectedNumbers.length} recipient(s)
            </p>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={sending || selectedNumbers.length === 0}
          className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <span className="inline-block animate-pulse">Sending...</span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send SMS
            </>
          )}
        </button>

      </form>
    </div>
  );
}
