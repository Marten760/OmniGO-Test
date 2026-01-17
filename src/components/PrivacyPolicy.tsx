import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export const PrivacyPolicy = ({ onBack }: { onBack: () => void }) => {
  // Effect to handle smooth scrolling and other DOM manipulations
  useEffect(() => {
    // Smooth scrolling for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement;
      const href = target.closest('a')?.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const targetElement = document.querySelector(href);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  // It's generally better to manage styles externally (e.g., CSS modules, Tailwind config)
  // or define them as objects if truly component-specific and small.
  // For this case, given the existing Tailwind usage, consider moving these to a global CSS file
  // or using utility classes directly in JSX where possible.

  return (
    <div className="privacy-policy-container text-gray-300">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 font-semibold">
          <ArrowLeft size={18} />
          Back to Account
        </button>
      )}

      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 italic mb-6">Last updated: September 15, 2025</p>

        <div className="toc bg-gray-900/50 p-4 rounded-xl mb-6 border border-gray-700">
          <h2 className="toc-title !border-0 !m-0 !p-0 !text-xl">Table of Contents</h2>
          <ul className="toc-list !p-0 mt-4">
            <li><a href="#info-we-collect" className="text-purple-300 hover:text-pink-400">1. Information We Collect</a></li>
            {/* Added missing section numbers for clarity and consistency with the HTML version */}
            <li><a href="#how-we-use" className="text-purple-300 hover:text-pink-400">How We Use Your Information</a></li>
            <li><a href="#legal-basis" className="text-purple-300 hover:text-pink-400">Legal Basis for Processing Data</a></li>
            <li><a href="#sharing-info" className="text-purple-300 hover:text-pink-400">Sharing Your Information</a></li>
            <li><a href="#data-retention" className="text-purple-300 hover:text-pink-400">Data Retention</a></li>
            <li><a href="#data-transfers" className="text-purple-300 hover:text-pink-400">International Data Transfers</a></li>
            <li><a href="#data-security" className="text-purple-300 hover:text-pink-400">Data Security</a></li>
            <li><a href="#your-rights" className="text-purple-300 hover:text-pink-400">Your Privacy Rights</a></li>
            <li><a href="#children-privacy" className="text-purple-300 hover:text-pink-400">Children's Privacy</a></li>
            <li><a href="#policy-changes" className="text-purple-300 hover:text-pink-400">Changes to This Policy</a></li>
            <li><a href="#third-party-services" className="text-purple-300 hover:text-pink-400">11. Third-Party Services (Pi Network)</a></li> {/* Added missing TOC entry */}
          </ul>
        </div>

        <div className="space-y-4">
          <p>Welcome to OmniGo. We value your trust in using our application and are committed to protecting your personal data. This Privacy Policy ("Policy") explains how we collect, use, protect, and disclose your data when you use our application and services ("Service").</p>
          <p><strong>By using the Service, you consent to the privacy practices described in this Policy.</strong></p>

          <h2 id="info-we-collect">1. Information We Collect</h2>
          <p>We collect several different types of information to provide and improve our Service.</p> {/* No change, but keeping for context */}

          <h3>1.1 Information You Provide Directly:</h3>
          <ul>
            <li><strong>Account Information:</strong> When logging in via Pi Browser <span className="pi-badge">Pi Network</span>, we collect your user ID and username from the Pi Network to create and manage your account.</li>
            <li><strong>Profile Information:</strong> The name you choose, email address, phone number, and delivery addresses you save.</li>
            <li><strong>Store Information (For Store Owners):</strong> If you are a store owner, we collect store information you provide (store name, description, address, working hours, contact information, delivery fees) and product information (images, names, prices, descriptions, inventory status).</li>
            <li><strong>Order Content:</strong> Products you order, quantities, special instructions, delivery address, and any discount codes you use.</li>
            <li><strong>Content You Create:</strong> Ratings and reviews you leave on stores and products.</li>
            <li><strong>Support Communications:</strong> Any information you provide when contacting customer support.</li>
          </ul>
          {/* No change, but keeping for context */}
          <h3>1.2 Information We Collect Automatically:</h3>
          <ul>
            <li><strong>Usage Data:</strong> We collect information about how you interact with the Service, such as stores you browse, products you search for, and visit duration. This includes IP address, browser type and version, app pages you visit, time and date of visit, and time spent on those pages.</li>
            <li><strong>Device Data:</strong> Device type, operating system, and unique device identifier.</li>
            <li><strong>Location Data (With Your Permission):</strong> With your permission, we may collect information about your precise location (GPS) to connect you with nearby stores and facilitate delivery. You can enable or disable access to location data at any time through your device settings.</li>
          </ul>

          <h3>1.3 Payment Information:</h3> {/* No change, but keeping for context */}
          <ul>
            <li><strong>Pi Transactions:</strong> To facilitate transactions, we process payment information through the Pi Network. <strong>We confirm that we do not collect, store, or process any sensitive wallet information (such as Secret Seed/Phrase).</strong> All payment authentication and approval processes are securely handled through the Pi SDK. We only store the transaction ID, amount, and status to track orders and resolve any disputes.</li>
          </ul>

          <h2 id="how-we-use">2. How We Use Your Information</h2>
          <p>We use the information we collect for the following purposes:</p>
          <ul>
            <li><strong>To Provide and Maintain the Service:</strong> To create your account, process your orders, facilitate payments, manage stores, and deliver orders to you.</li>
            <li><strong>To Communicate With You:</strong> To send updates about your orders, important service notices, promotional offers (if you consent), and responses to your support inquiries.</li>
            <li><strong>To Improve and Develop Our Service:</strong> To analyze app performance, understand how customers use it, identify areas needing improvement, and develop new features.</li>
            <li><strong>For Security and Fraud Prevention:</strong> To detect and prevent fraudulent activities and misuse to protect the security of our users and our service.</li>
            <li><strong>For Legal Purposes:</strong> To comply with legal obligations and resolve any disputes.</li>
          </ul> {/* No change, but keeping for context */}

          <h2 id="legal-basis">3. Legal Basis for Processing Data (For EEA Users)</h2>
          <p>We process your data based on the following legal grounds:</p>
          <ul>
            <li><strong>Performance of Contract:</strong> Processing your orders and providing the Service to you.</li>
            <li><strong>Legitimate Interests:</strong> Analyzing data to improve our service, direct marketing (with opt-out option always available).</li>
            <li><strong>Consent:</strong> When we explicitly request your consent, such as for collecting precise location data or sending promotional marketing messages.</li>
            <li><strong>Legal Obligation:</strong> When we are legally required to process your data.</li>
          </ul> {/* No change, but keeping for context */}

          <h2 id="sharing-info">4. Sharing Your Information</h2>
          <p>We may share your information with the following parties:</p>
          <ul>
            <li><strong>Store Owners:</strong> We share your order details (delivery address, products, instructions) with the store owner to complete and prepare your order.</li>
            <li><strong>Delivery Service Providers:</strong> If the store uses an external delivery service, we may share contact and address information with them to deliver your order.</li>
            <li><strong>Service Providers ("Third-Party Processors"):</strong> Other companies that provide services to us, such as data hosting, analytics, payment processing (Pi Network), and customer support. These providers only have access to your data to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.</li>
            <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or asset sale, your data may be transferred. We will notify you before your data becomes subject to a different privacy policy.</li>
            <li><strong>Legal Compliance:</strong> We may disclose your information if required to do so by law or in response to a valid legal request.</li>
          </ul> {/* No change, but keeping for context */}

          <h2 id="data-retention">5. Data Retention</h2>
          <p>We will retain your personal data only for as long as necessary to fulfill the purposes outlined in this Policy. We retain order data and financial information for periods required by law for tax and accounting purposes. Account data will be retained as long as your account is active or as needed to provide services to you. You can request deletion of your account at any time.</p>

          <h2 id="data-transfers">6. International Data Transfers</h2>
          <p>Your information may be processed on servers located outside your country, where data protection laws may differ from those in your jurisdiction. We take all reasonable steps to ensure your data is processed securely and in accordance with this Privacy Policy. By using the Service, you consent to this transfer.</p>

          <h2 id="data-security">7. Data Security</h2>
          <p>We use reasonable administrative, technical, and physical security measures to protect your personal data. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee its absolute security.</p>

          <h2 id="your-rights">8. Your Privacy Rights (GDPR and CCPA Rights)</h2>
          <p>You have rights regarding your personal data, including:</p>
          <ul>
            <li><strong>Access and Correction:</strong> The right to access and correct your data that we hold.</li>
            <li><strong>Deletion:</strong> The right to delete your personal data.</li>
            <li><strong>Objection:</strong> The right to object to the processing of your data for direct marketing purposes or in other specific circumstances.</li>
            <li><strong>Restriction of Processing:</strong> The right to request restriction of how we use your data.</li>
            <li><strong>Data Portability:</strong> The right to receive your data in a structured, machine-readable format.</li>
          </ul> {/* No change, but keeping for context */}
          <p>To exercise any of these rights, please contact us at: <strong>OmniGo.privacy@gmail.com</strong>. We will respond to your request within one month.</p>

          <h2 id="children-privacy">9. Children's Privacy</h2>
          <p>Our Service is not intended for users under the age of 13 ("Children"), and we do not knowingly collect any personal information from Children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will delete this information from our records.</p>

          <h2 id="policy-changes">10. Changes to This Privacy Policy</h2>
          <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date at the top. We advise you to review this policy periodically for any changes.</p>

          <h2 id="third-party-services">11. Third-Party Services (Pi Network)</h2>
          <p>Our Service is built on the Pi Network and utilizes its Developer Tools (including the Pi SDK for authentication and payments). Please be aware of the following:</p>
          <ul>
            <li><strong>Data Sharing with Pi Network:</strong> To facilitate authentication and transactions, certain data is shared with the Pi Network as described in their terms. We are not responsible for the data practices of the Pi Network itself.</li>
            <li><strong>No Endorsement:</strong> Our use of Pi Network's tools does not imply an endorsement or partnership. We are an independent application operating on their platform.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};