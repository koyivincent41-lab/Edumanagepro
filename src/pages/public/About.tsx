import React from 'react';
import PublicLayout from '../../components/PublicLayout';
import { Shield, Users, Target, Award } from 'lucide-react';

export default function About() {
  return (
    <PublicLayout>
      <div className="py-32 bg-white dark:bg-gray-950 relative overflow-hidden transition-colors duration-300">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-1 bg-striped-maroon opacity-10"></div>
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gray-50 dark:bg-gray-900/50 -z-10 skew-x-12 translate-x-20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="text-center mb-24">
            <h1 className="text-6xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter leading-none mb-8">
              About <br /> <span className="text-maroon">EduManagePro</span>
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto font-medium">
              We are dedicated to revolutionizing school management through modern, intuitive, and scalable technology.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-32">
            <div className="relative">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-maroon/5 rounded-full blur-3xl -z-10"></div>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">Our Mission</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed font-medium mb-8">
                To empower educational institutions with the tools they need to focus on what matters most: student success. We simplify administrative burdens, automate financial tracking, and enhance communication between schools and parents.
              </p>
              <div className="flex gap-4">
                <div className="w-12 h-1 bg-maroon rounded-full"></div>
                <div className="w-4 h-1 bg-maroon/20 rounded-full"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {[
                { icon: Shield, title: 'Secure', desc: 'Enterprise-grade security' },
                { icon: Users, title: 'Collaborative', desc: 'Built for teams' },
                { icon: Target, title: 'Focused', desc: 'Results-driven' },
                { icon: Award, title: 'Reliable', desc: '99.9% Uptime' },
              ].map((item) => (
                <div key={item.title} className="p-10 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
                  <div className="w-14 h-14 bg-maroon/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-maroon transition-all duration-500">
                    <item.icon className="h-7 w-7 text-maroon group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">{item.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
