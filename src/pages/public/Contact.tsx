import React, { useState } from 'react';
import PublicLayout from '../../components/PublicLayout';
import { FormInput, Phone, MapPin, MessageSquare, Loader2 } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.email || !formData.message) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullMessage = `User Phone: ${formData.phone || 'N/A'}\n\nMessage:\n${formData.message}`;
      
      await addDoc(collection(db, 'system_emails'), {
        from: formData.email,
        to: 'support@edumanagepro.com',
        subject: `Website Inquiry from ${formData.firstName} ${formData.lastName}`,
        message: fullMessage,
        type: 'incoming',
        status: 'received',
        read: false,
        createdAt: new Date().toISOString(),
        senderName: `${formData.firstName} ${formData.lastName}`
      });

      toast.success('Message sent successfully! We will get back to you soon.');
      setFormData({ firstName: '', lastName: '', email: '', phone: '', message: '' });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <div className="py-32 bg-white dark:bg-gray-950 relative overflow-hidden transition-colors duration-300">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-1 bg-striped-maroon opacity-10"></div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gray-50 dark:bg-gray-900/50 -z-10 skew-x-12 translate-x-20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="text-center mb-24">
            <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-8">
              Get in <span className="text-maroon">Touch</span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium">
              Have questions? We're here to help you get started on your journey with EduManagePro.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
            <div className="space-y-12">
              <div className="group flex items-start gap-4 md:gap-8 p-4 md:p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="p-5 bg-maroon/10 rounded-2xl text-maroon group-hover:bg-maroon group-hover:text-white transition-all duration-500">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase tracking-widest text-xs">Contact Form</h3>
                  <p className="text-gray-600 dark:text-gray-400 font-bold">Fill out the form to send us a direct message.</p>
                </div>
              </div>

              <div className="group flex items-start gap-4 md:gap-8 p-4 md:p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="p-5 bg-maroon/10 rounded-2xl text-maroon group-hover:bg-maroon group-hover:text-white transition-all duration-500">
                  <Phone className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase tracking-widest text-xs">Call Us</h3>
                  <p className="text-gray-600 dark:text-gray-400 font-bold">USA: +1(719) 351-3094</p>
                  <p className="text-gray-600 dark:text-gray-400 font-bold">Kenya: +254729934770</p>
                  <p className="text-gray-600 dark:text-gray-400 font-bold">Mon - Fri, 8am - 5pm</p>
                </div>
              </div>

              <div className="group flex items-start gap-4 md:gap-8 p-4 md:p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-500">
                <div className="p-5 bg-maroon/10 rounded-2xl text-maroon group-hover:bg-maroon group-hover:text-white transition-all duration-500">
                  <MapPin className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight uppercase tracking-widest text-xs">Visit Us</h3>
                  <p className="text-gray-600 dark:text-gray-400 font-bold">2510 Piros Dr, Colorado Springs, USA</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-bl from-[#800000] via-[#800000]/90 to-gray-900 p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gray-900/50 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
              <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  <div>
                    <label className="block text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">First Name</label>
                    <input 
                      className="w-full px-4 md:px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:border-white focus:bg-white/20 outline-none transition-all font-bold backdrop-blur-sm" 
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">Last Name</label>
                    <input 
                      className="w-full px-4 md:px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:border-white focus:bg-white/20 outline-none transition-all font-bold backdrop-blur-sm" 
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">Email Address</label>
                  <input 
                    type="email"
                    className="w-full px-4 md:px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:border-white focus:bg-white/20 outline-none transition-all font-bold backdrop-blur-sm" 
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">Phone Number</label>
                  <input 
                    type="tel"
                    className="w-full px-4 md:px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:border-white focus:bg-white/20 outline-none transition-all font-bold backdrop-blur-sm" 
                    placeholder="+1 234 567 8900"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">Message</label>
                  <textarea 
                    rows={4} 
                    className="w-full px-4 md:px-6 py-4 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/50 focus:border-white focus:bg-white/20 outline-none transition-all font-bold resize-none backdrop-blur-sm" 
                    placeholder="How can we help you?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-white text-[#800000] font-black rounded-2xl shadow-xl hover:scale-105 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
