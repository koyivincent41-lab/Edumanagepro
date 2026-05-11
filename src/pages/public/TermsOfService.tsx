import React from 'react';
import PublicLayout from '../../components/PublicLayout';

export default function TermsOfService() {
  return (
    <PublicLayout>
      <div className="py-32 bg-white dark:bg-gray-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-4 md:px-6 lg:px-4 md:px-8">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">Terms of Service</h1>
          
          <div className="prose prose-lg max-w-none text-gray-600 dark:text-gray-400 space-y-6 font-medium">
            <p>
              Welcome to EduManagePro. These Terms of Service ("Terms") govern your access to and use of our website and school management platform. By using our services, you agree to be bound by these Terms.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using our platform, you agree to comply with and be bound by these Terms. If you do not agree to these Terms, please do not use our services.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">2. Use of the Platform</h2>
            <p>
              You agree to use our platform only for lawful purposes and in accordance with these Terms. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">3. Subscriptions and Payments</h2>
            <p>
              We offer various subscription plans for our services. By subscribing to a plan, you agree to pay the fees associated with that plan. Fees are non-refundable except as required by law. We reserve the right to change our fees at any time, with notice to you.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">4. Intellectual Property</h2>
            <p>
              All content on our platform, including text, graphics, logos, and software, is the property of EduManagePro or its licensors and is protected by intellectual property laws. You may not use our content without our express written permission.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, EduManagePro shall not be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of our platform.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">6. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your access to our platform at any time, without notice, for any reason, including if you breach these Terms.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">7. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law principles.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">8. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of any changes by posting the new Terms on our website. Your continued use of the platform after such changes constitutes your acceptance of the new Terms.
            </p>

            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-12 mb-4">9. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
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
