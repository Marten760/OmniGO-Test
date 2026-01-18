import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

export const TermsOfService = ({ onBack }: { onBack?: () => void }) => {
  useEffect(() => {
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

  return (
    <div className="privacy-policy-container text-gray-300">
      {/* Reusing styles from PrivacyPolicy.tsx for consistency */}
      <style>{`
        .privacy-policy-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; }
        .privacy-policy-container h2 { color: #a78bfa; margin: 2rem 0 1.2rem; padding-bottom: 0.5rem; border-bottom: 2px solid #374151; font-weight: 600; }
        .privacy-policy-container h3 { color: #c4b5fd; margin: 1.5rem 0 0.8rem; font-weight: 500; }
        .privacy-policy-container p, .privacy-policy-container ul { margin-bottom: 1.2rem; color: #d1d5db; }
        .privacy-policy-container ul { padding-left: 1.8rem; list-style: none; }
        .privacy-policy-container li { margin-bottom: 0.6rem; position: relative; }
        .privacy-policy-container ul li::before { content: '•'; color: #f472b6; font-weight: bold; display: inline-block; width: 1em; margin-left: -1em; }
      `}</style>

      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 font-semibold">
          <ArrowLeft size={18} />
          Back to Account
        </button>
      )}

      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 italic mb-6">Last updated: January 18, 2026</p>

        <div className="toc bg-gray-900/50 p-4 rounded-xl mb-6 border border-gray-700">
          <h2 className="toc-title !border-0 !m-0 !p-0 !text-xl">Table of Contents</h2>
          <ul className="toc-list !p-0 mt-4">
            <li><a href="#acceptance" className="text-purple-300 hover:text-pink-400">1. Acceptance of Terms</a></li>
            <li><a href="#accounts" className="text-purple-300 hover:text-pink-400">2. User Accounts</a></li>
            <li><a href="#services" className="text-purple-300 hover:text-pink-400">3. Our Services</a></li>
            <li><a href="#payments" className="text-purple-300 hover:text-pink-400">4. Payments and Transactions</a></li>
            <li><a href="#user-conduct" className="text-purple-300 hover:text-pink-400">5. User Conduct</a></li>
            <li><a href="#store-owners" className="text-purple-300 hover:text-pink-400">6. Store Owner Responsibilities</a></li>
            <li><a href="#termination" className="text-purple-300 hover:text-pink-400">7. Termination</a></li>
            <li><a href="#disclaimers" className="text-purple-300 hover:text-pink-400">8. Disclaimers</a></li>
            <li><a href="#limitation" className="text-purple-300 hover:text-pink-400">9. Limitation of Liability</a></li>
            <li><a href="#changes" className="text-purple-300 hover:text-pink-400">10. Changes to Terms</a></li>
            <li><a href="#intellectual-property" className="text-purple-300 hover:text-pink-400">11. Intellectual Property</a></li>
            <li><a href="#governing-law" className="text-purple-300 hover:text-pink-400">12. Governing Law & Dispute Resolution</a></li>
            <li><a href="#general-provisions" className="text-purple-300 hover:text-pink-400">13. General Provisions</a></li>
            <li><a href="#pi-network-relation" className="text-purple-300 hover:text-pink-400">14. Relationship with Pi Network</a></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h2 id="acceptance">1. Acceptance of Terms</h2>
          <p>By accessing or using the OmniGo application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, do not use the Service. These Terms apply to all users, including customers and store owners. These terms may also be subject to additional terms and conditions specific to your region. By using the Service, you confirm that you are legally eligible to be bound by these Terms.</p>

          <h2 id="accounts">2. User Accounts</h2>
          <p>To use the full features of our Service, you must create an account. We offer two types of access:</p>
          <ul>
            <li><strong>Pi Account Login:</strong> By logging in with your Pi Network account, you can make payments using Pi coins. You are responsible for maintaining the security of your Pi account.</li>
          </ul>
          <p>You are responsible for all activities that occur under your account. You are responsible for:</p>
          <ul>
            <li>The accuracy and timeliness of the information you provide.</li>
            <li>Maintaining the confidentiality of your account information.</li>
            <li>Notifying us immediately of any unauthorized use of your account.</li>
            <li>You are fully responsible for any activity that occurs under your account.</li>
          </ul>

          <h2 id="services">3. Our Services</h2>
          <p>OmniGo provides a platform that connects users with local stores ("Stores") to order products and services. You expressly understand and agree that:</p>
          <ul>
            <li>OmniGo acts as a technical intermediary between you and independent stores. We do not own, operate, or control the quality, safety, or legality of any products offered, or the accuracy of store listings.</li>
            <li>Any contractual relationship regarding the sale or delivery of products is established directly between you and the store only. We are not a party to those transactions.</li>
            <li>We do not verify the identity of all users or the accuracy of their information. We rely on the accuracy of the information provided by users and store owners.</li>
          </ul>

          <h2 id="payments">4. Payments and Transactions</h2>
          <p>All payments for orders are processed through the Pi Network. By placing an order, you authorize the transaction through the Pi SDK. OmniGo does not store your private wallet keys or secret phrases. We only record transaction details (ID, amount, status) for order fulfillment and support. In addition to the product price, you may be subject to:</p>
          <p><strong>Escrow System:</strong> To protect both parties, funds are held in escrow by the platform. Payouts to stores are released only after the order is marked as delivered and the dispute window has closed without active issues.</p>
          <p><strong>Payouts & Refunds:</strong> To receive payouts (for store owners) or refunds (for customers), you must provide a valid Pi Network Public Wallet Address. We are not responsible for funds lost due to incorrect wallet addresses provided by you.</p>
          <ul>
            <li><strong>Delivery Fee:</strong> Determined independently by the stores and displayed upon request.</li>
            <li><strong>Taxes:</strong> You are responsible for any applicable taxes associated with your transactions.</li>
            <li><strong>Refunds & Disputes:</strong> You may report issues with an order within 48 hours of delivery. Refunds are subject to review of the claim and evidence. While OmniGo facilitates this process, final resolution may depend on the store's policy and the validity of the report.</li>
          </ul>

          <h2 id="user-conduct">5. User Conduct</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any laws or regulations.</li>
            <li>Post false, inaccurate, or misleading information (including in reviews).</li>
            <li>Engage in fraudulent activities.</li>
            <li>Interfere with the operation of the Service or any user's enjoyment of it, including impersonating any person or entity.</li>
            <li>Collect or store personal information about other users.</li>
            <li>Use any automated software or means to extract data or monitor the Service.</li>
            <li>Interfere with or disrupt the security of the Service.</li>
          </ul>

          <h2 id="store-owners">6. Store Owner Responsibilities</h2>
          <p>By creating a store on OmniGo, you warrant and agree to the following:</p>
          <ul>
            <li><strong>Legal Compliance:</strong> You are responsible for complying with all local laws and regulations related to your business, including sales licenses, food safety (if a restaurant), health regulations, and consumer protection laws.</li>
            <li><strong>Listing Accuracy:</strong> Provide accurate and substantive descriptions of products, including prices and images that reflect the actual product. Any misrepresentation may result in the cancellation of your store.</li>
            <li><strong>Order Fulfillment:</strong> You are legally obligated to complete any order accepted through our platform, unless there is a clear error in pricing or product description.</li>
            <li><strong>Customer Service and Refunds:</strong> You are primarily responsible for resolving customer complaints. You agree to participate in the platform's dispute resolution process and accept that refunds may be processed from escrowed funds if a dispute is resolved in the customer's favor.</li>
            <li><strong>Escrow & Payouts:</strong> You acknowledge that funds from your sales are held in escrow by OmniGo and are released to your provided wallet address only after the order is confirmed delivered and the dispute period (48 hours) has expired without active claims. You agree to the automatic deduction of the platform commission from each payout.</li>
            <li><strong>Taxes:</strong> You are solely responsible for calculating and remitting any taxes related to your sales.</li>
          </ul>

          <h2 id="termination">7. Termination</h2>
          <p>You may terminate your use of the Service at any time by deactivating your account. We may suspend or terminate your access to the Service immediately, without prior notice or liability, if we determine, in our sole discretion, that you have violated these Terms. Upon termination, your right to use the Service will immediately cease.</p>

          <h2 id="disclaimers">8. Disclaimers</h2>
          <p>THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. OmniGo MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE OPERATION OF THE SERVICE OR THE INFORMATION, CONTENT, OR MATERIALS INCLUDED THEREIN. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. ANY CONTENT OR DATA OBTAINED THROUGH THE USE OF THE SERVICE IS DONE AT YOUR OWN RISK AND YOU WILL BE SOLELY RESPONSIBLE FOR ANY DAMAGE TO YOUR PROPERTY OR LOSS OF DATA.</p>

          <h2 id="limitation">9. Limitation of Liability</h2>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL OmniGo, NOR ITS DIRECTORS, EMPLOYEES, OR AGENTS, BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE, INCLUDING STORES; (III) ANY BUGS, VIRUSES, OR ERRORS IN THE UNDERLYING SOFTWARE (INCLUDING THE PI SDK). OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM SHALL NOT EXCEED THE AMOUNT OF SERVICE FEES YOU PAID TO US, IF ANY, DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</p>

          <h2 id="changes">10. Changes to Terms</h2>
          <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

          <h2 id="intellectual-property">11. Intellectual Property</h2>
          <p>The OmniGo name, logo, and all related intellectual property rights in the Service, its design, and its content (excluding user-generated content and store content) are our exclusive property or that of our licensors. You may not copy, modify, distribute, or create derivative works from any of them without our express prior consent. By posting content (e.g., reviews, store information), you grant us a perpetual, worldwide, fully paid-up right and license to use, copy, modify, and distribute such content in connection with the Service.</p>

          <h2 id="governing-law">12. Governing Law & Dispute Resolution</h2>
          <p>The interpretation and governance of these Terms shall be subject to the laws of [Your Country/State]. Any dispute arising from these Terms shall first be attempted to be resolved through friendly negotiation. If that fails, you agree that the dispute shall be finally settled through binding arbitration [or in the courts of [Your City, Country]].</p>

          <h2 id="general-provisions">13. General Provisions</h2>
          <ul>
            <li>If any provision of these Terms is found to be unenforceable, that provision will be severed or interpreted to reflect the original intention, and the remaining provisions will remain in full force and effect.</li>
            <li>Our failure to enforce any right or provision in these Terms does not waive that right or provision.</li>
          </ul>

          <h2 id="pi-network-relation">14. Relationship with Pi Network</h2>
          <p>OmniGo is an independent application built on the Pi Network platform. We are not operated by, nor are we partners with, the Pi Core Team. Your use of Pi-related features is also subject to the Pi Network's master Terms of Service and Privacy Policy. We are not responsible for the operation, security, or any issues arising from the Pi Network or Pi Wallet itself.</p>
        </div>
      </div>
    </div>
  );
};