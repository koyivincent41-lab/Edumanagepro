import React, { useState, useEffect } from 'react';
import { useParams, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { School } from '../../types';
import { MapPin, Phone, Mail, Menu, X, ChevronRight, GraduationCap, BookOpen, Users, Award } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

export default function PublicSchoolWebsite() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [websiteData, setWebsiteData] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchWebsiteData = async () => {
      if (!slug) return;
      try {
        // Find website by slug
        const websitesRef = collection(db, 'websites');
        const q = query(websitesRef, where('slug', '==', slug));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const webData = querySnapshot.docs[0].data();
          setWebsiteData(webData);

          if (webData.isPublished) {
            // Fetch school data
            const schoolRef = doc(db, 'schools', webData.schoolId);
            const schoolSnap = await getDoc(schoolRef);
            if (schoolSnap.exists()) {
              setSchool({ id: schoolSnap.id, ...schoolSnap.data() } as School);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching website data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWebsiteData();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!websiteData || !websiteData.isPublished || !school) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <GraduationCap className="w-16 h-16 text-gray-400 mb-4" />
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">Website Not Found</h1>
        <p className="text-gray-600 max-w-md">
          The school website you are looking for does not exist or is currently unpublished.
        </p>
        <Link to="/" className="mt-8 px-4 md:px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          Return to Main Platform
        </Link>
      </div>
    );
  }

  // Theme colors
  const primaryColor = school.primaryColor || '#1e40af';
  const secondaryColor = school.secondaryColor || '#3b82f6';

  const NavLinks = () => (
    <>
      <Link to={`/s/${slug}`} className={`font-medium hover:opacity-80 transition-opacity ${location.pathname === `/s/${slug}` ? 'text-primary' : 'text-gray-700'}`}>Home</Link>
      <Link to={`/s/${slug}/about`} className={`font-medium hover:opacity-80 transition-opacity ${location.pathname === `/s/${slug}/about` ? 'text-primary' : 'text-gray-700'}`}>About Us</Link>
      <Link to={`/s/${slug}/contact`} className={`font-medium hover:opacity-80 transition-opacity ${location.pathname === `/s/${slug}/contact` ? 'text-primary' : 'text-gray-700'}`}>Contact</Link>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white py-2 px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center space-x-4">
            {school.phone && (
              <span className="flex items-center"><Phone className="w-4 h-4 mr-2" /> {school.phone}</span>
            )}
            {school.email && (
              <span className="flex items-center"><Mail className="w-4 h-4 mr-2" /> {school.email}</span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Link to="/login" className="hover:text-gray-300 transition-colors">Portal Login</Link>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to={`/s/${slug}`} className="flex items-center space-x-3">
              {school.logo ? (
                <img src={school.logo} alt={school.name} className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: primaryColor }}>
                  {school.name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{school.name}</h1>
                {school.motto && <p className="text-xs text-gray-500 hidden sm:block">{school.motto}</p>}
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center space-x-8">
              <NavLinks />
              <Link 
                to={`/s/${slug}/contact`}
                className="px-5 py-2.5 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Admissions
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-gray-600"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 pt-2 pb-4 space-y-4 shadow-lg absolute w-full">
            <div className="flex flex-col space-y-4 pt-2">
              <NavLinks />
              <Link 
                to={`/s/${slug}/contact`}
                className="px-5 py-2.5 text-white rounded-lg font-medium text-center"
                style={{ backgroundColor: primaryColor }}
                onClick={() => setIsMenuOpen(false)}
              >
                Admissions
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage school={school} websiteData={websiteData} primaryColor={primaryColor} />} />
          <Route path="/about" element={<AboutPage school={school} websiteData={websiteData} primaryColor={primaryColor} />} />
          <Route path="/contact" element={<ContactPage school={school} primaryColor={primaryColor} />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                {school.logo ? (
                  <img src={school.logo} alt={school.name} className="h-10 w-auto object-contain bg-white rounded p-1" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded bg-white flex items-center justify-center font-bold text-xl" style={{ color: primaryColor }}>
                    {school.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-xl font-bold">{school.name}</h2>
              </div>
              <p className="text-gray-400 mb-6">
                {websiteData.aboutText ? websiteData.aboutText.substring(0, 120) + '...' : `Welcome to ${school.name}, where we nurture learning, discipline, and excellence.`}
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-6 border-b border-gray-800 pb-2">Quick Links</h3>
              <ul className="space-y-3">
                <li><Link to={`/s/${slug}`} className="text-gray-400 hover:text-white transition-colors">Home</Link></li>
                <li><Link to={`/s/${slug}/about`} className="text-gray-400 hover:text-white transition-colors">About Us</Link></li>
                <li><Link to={`/s/${slug}/contact`} className="text-gray-400 hover:text-white transition-colors">Contact</Link></li>
                <li><Link to="/login" className="text-gray-400 hover:text-white transition-colors">Parent Portal</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-6 border-b border-gray-800 pb-2">Contact Us</h3>
              <ul className="space-y-4">
                {school.address && (
                  <li className="flex items-start">
                    <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                    <span className="text-gray-400">{school.address}</span>
                  </li>
                )}
                {school.phone && (
                  <li className="flex items-center">
                    <Phone className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="text-gray-400">{school.phone}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved.</p>
            <p className="mt-2 md:mt-0">Powered by School Management System</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Page Components ---

function HomePage({ school, websiteData, primaryColor }: { school: School, websiteData: any, primaryColor: string }) {
  const heroTitle = websiteData.heroTitle || `Welcome to ${school.name}`;
  const heroSubtitle = websiteData.heroSubtitle || "Nurturing learning, discipline, and excellence for a brighter future.";
  const aboutText = websiteData.aboutText || "Our school is committed to providing quality education in a supportive environment. We believe in holistic development, fostering academic excellence alongside character building. Our dedicated staff works tirelessly to ensure every student reaches their full potential.";

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gray-900 text-white py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-900/50"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 z-10">
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {heroTitle}
            </h1>
            <p className="text-xl md:text-xl md:text-2xl text-gray-300 mb-10 max-w-2xl">
              {heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="about" 
                className="px-4 md:px-8 py-4 rounded-full font-semibold text-center transition-transform hover:scale-105"
                style={{ backgroundColor: primaryColor, color: 'white' }}
              >
                Learn More About Us
              </Link>
              <Link 
                to="contact" 
                className="px-4 md:px-8 py-4 rounded-full font-semibold text-center bg-white text-gray-900 hover:bg-gray-100 transition-transform hover:scale-105"
              >
                Contact Admissions
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features/Highlights */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-4">Why Choose {school.name}?</h2>
            <div className="w-24 h-1 mx-auto rounded" style={{ backgroundColor: primaryColor }}></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="p-4 md:p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-shadow text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Academic Excellence</h3>
              <p className="text-gray-600">We provide a rigorous curriculum designed to challenge students and foster a lifelong love of learning.</p>
            </div>
            
            <div className="p-4 md:p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-shadow text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Dedicated Staff</h3>
              <p className="text-gray-600">Our experienced educators are passionate about teaching and committed to the success of every student.</p>
            </div>
            
            <div className="p-4 md:p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-shadow text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Holistic Development</h3>
              <p className="text-gray-600">Beyond academics, we focus on character building, sports, and extracurricular activities for well-rounded growth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Preview */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1509062522246-3755977927d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                alt="Students learning" 
                className="rounded-2xl shadow-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6">About Our School</h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                {aboutText}
              </p>
              <Link 
                to="about" 
                className="inline-flex items-center font-semibold hover:underline"
                style={{ color: primaryColor }}
              >
                Read our full story <ChevronRight className="w-5 h-5 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AboutPage({ school, websiteData, primaryColor }: { school: School, websiteData: any, primaryColor: string }) {
  const aboutText = websiteData.aboutText || "Our school is committed to providing quality education in a supportive environment. We believe in holistic development, fostering academic excellence alongside character building. Our dedicated staff works tirelessly to ensure every student reaches their full potential.";
  const mission = websiteData.mission || "To empower students with knowledge, skills, and values to become responsible global citizens and lifelong learners.";
  const vision = websiteData.vision || "To be a leading center of excellence in education, inspiring innovation, leadership, and positive societal impact.";
  const values = websiteData.values || "Integrity, Excellence, Respect, Collaboration, and Innovation.";

  return (
    <div>
      {/* Page Header */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">About Us</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Discover our history, mission, and the values that drive us.</p>
        </div>
      </div>

      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="prose prose-lg max-w-none text-gray-600">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-6">Welcome to {school.name}</h2>
            <p className="mb-12 leading-relaxed">{aboutText}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16">
              <div className="bg-gray-50 p-4 md:p-8 rounded-2xl border border-gray-100">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm mr-3" style={{ backgroundColor: primaryColor }}>M</span>
                  Our Mission
                </h3>
                <p>{mission}</p>
              </div>
              
              <div className="bg-gray-50 p-4 md:p-8 rounded-2xl border border-gray-100">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm mr-3" style={{ backgroundColor: primaryColor }}>V</span>
                  Our Vision
                </h3>
                <p>{vision}</p>
              </div>
            </div>

            <div className="mt-12 bg-gray-50 p-4 md:p-8 rounded-2xl border border-gray-100">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm mr-3" style={{ backgroundColor: primaryColor }}>C</span>
                Core Values
              </h3>
              <p>{values}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactPage({ school, primaryColor }: { school: School, primaryColor: string }) {
  return (
    <div>
      {/* Page Header */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Get in touch with us for admissions, inquiries, or more information.</p>
        </div>
      </div>

      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Contact Info */}
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-8">Get In Touch</h2>
              
              <div className="space-y-8">
                {school.address && (
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-semibold text-gray-900">Visit Us</h3>
                      <p className="mt-2 text-gray-600">{school.address}</p>
                    </div>
                  </div>
                )}

                {school.phone && (
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-semibold text-gray-900">Call Us</h3>
                      <p className="mt-2 text-gray-600">{school.phone}</p>
                    </div>
                  </div>
                )}

                {school.email && (
                  <div className="flex items-start">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      <Mail className="w-6 h-6" />
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-semibold text-gray-900">Email Us</h3>
                      <p className="mt-2 text-gray-600">{school.email}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-12 p-4 md:p-8 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Office Hours</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex justify-between"><span>Monday - Friday:</span> <span>8:00 AM - 5:00 PM</span></li>
                  <li className="flex justify-between"><span>Saturday:</span> <span>9:00 AM - 1:00 PM</span></li>
                  <li className="flex justify-between"><span>Sunday:</span> <span>Closed</span></li>
                </ul>
              </div>
            </div>

            {/* Contact Form Placeholder */}
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-lg border border-gray-100">
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Send us a message</h3>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input type="text" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-colors" placeholder="John" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input type="text" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-colors" placeholder="Doe" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input type="email" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-colors" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea rows={4} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary transition-colors" placeholder="How can we help you?"></textarea>
                </div>
                <button 
                  type="button" 
                  className="w-full py-4 px-4 md:px-6 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => alert("This is a preview. Form submission is disabled.")}
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
