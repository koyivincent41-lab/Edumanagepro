import React from 'react';
import PublicLayout from '../../components/PublicLayout';

export default function PrivacyPolicy() {
  return (
    <PublicLayout>
      <div className="py-32 bg-white dark:bg-gray-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none text-gray-600 dark:text-gray-400 space-y-6 font-medium">
            <p>
              At EduManagePro, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our school management platform.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when you register for an account, such as your school name, administrator name, email address, phone number, and billing information. We also collect data related to your school's students, parents, and financial records as part of the services we provide.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, operate, and maintain our platform</li>
              <li>Improve, personalize, and expand our services</li>
              <li>Understand and analyze how you use our platform</li>
              <li>Develop new products, services, features, and functionality</li>
              <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the platform</li>
              <li>Process your transactions and manage your subscriptions</li>
              <li>Send you emails and notifications related to your account</li>
              <li>Find and prevent fraud</li>
            </ul>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">3. Data Security</h2>
            <p>
              We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">4. Sharing Your Information</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy. We may share information with third-party service providers who perform services for us or on our behalf, such as payment processing, data analysis, email delivery, and hosting services.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">5. Your Data Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal data, including the right to access, correct, or delete the personal information we have collected about you.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">6. Contact Us</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at:
              <br />
              Email: support@edumanagepro.com
              <br />
              USA Office: 2510 Piros Dr, Colorado Springs
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
