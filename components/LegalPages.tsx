import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<Props> = ({ onBack }) => (
  <div className="min-h-screen bg-slate-950 animate-fade-in">
    <header className="border-b border-slate-800 px-6 py-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-12 text-slate-300 text-sm leading-relaxed space-y-6">
      <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
      <p className="text-slate-500 text-xs">Last updated: March 2026</p>

      <p>DeFiner Tech Ltd ("we", "our", "us") operates the SpeechGyms application (the "Service"). This Privacy Policy explains how we collect, use, and protect your information.</p>

      <h2 className="text-lg font-bold text-white pt-4">1. Information We Collect</h2>
      <p><strong className="text-white">Account Information:</strong> When you sign in with Google, we collect your name, email address, and profile picture.</p>
      <p><strong className="text-white">Audio Recordings:</strong> Speech recordings are processed by Google Gemini AI for analysis. Recordings are not stored on our servers after analysis is complete.</p>
      <p><strong className="text-white">Usage Data:</strong> We store your speech session history, scores, and analysis results to track your progress.</p>
      <p><strong className="text-white">Payment Information:</strong> Payment processing is handled by Stripe. We do not store your credit card details.</p>

      <h2 className="text-lg font-bold text-white pt-4">2. How We Use Your Information</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>To provide and improve the Service</li>
        <li>To process your speech recordings and generate AI analysis</li>
        <li>To manage your account and subscription</li>
        <li>To communicate with you about the Service</li>
      </ul>

      <h2 className="text-lg font-bold text-white pt-4">3. Data Sharing</h2>
      <p>We do not sell your personal data. We share data only with:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong className="text-white">Google Gemini AI:</strong> Audio recordings are sent for speech analysis</li>
        <li><strong className="text-white">Stripe:</strong> For payment processing</li>
        <li><strong className="text-white">Microsoft Azure:</strong> For hosting and data storage</li>
      </ul>

      <h2 className="text-lg font-bold text-white pt-4">4. Data Security</h2>
      <p>We use industry-standard security measures including SSL encryption, secure database connections, and JWT-based authentication to protect your data.</p>

      <h2 className="text-lg font-bold text-white pt-4">5. Data Retention</h2>
      <p>Your account data and session history are retained while your account is active. You may request deletion of your data at any time by contacting us.</p>

      <h2 className="text-lg font-bold text-white pt-4">6. Your Rights</h2>
      <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:info@definertech.com" className="text-blue-400 hover:underline">info@definertech.com</a>.</p>

      <h2 className="text-lg font-bold text-white pt-4">7. Cookies</h2>
      <p>We use localStorage to store your authentication token. We do not use third-party tracking cookies.</p>

      <h2 className="text-lg font-bold text-white pt-4">8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>

      <h2 className="text-lg font-bold text-white pt-4">9. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us:</p>
      <p><strong className="text-white">DeFiner Tech Ltd</strong><br />
      Email: <a href="mailto:info@definertech.com" className="text-blue-400 hover:underline">info@definertech.com</a></p>
    </main>
  </div>
);

export const TermsAndConditions: React.FC<Props> = ({ onBack }) => (
  <div className="min-h-screen bg-slate-950 animate-fade-in">
    <header className="border-b border-slate-800 px-6 py-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>
    </header>
    <main className="max-w-3xl mx-auto px-6 py-12 text-slate-300 text-sm leading-relaxed space-y-6">
      <h1 className="text-3xl font-black text-white">Terms & Conditions</h1>
      <p className="text-slate-500 text-xs">Last updated: March 2026</p>

      <p>These Terms and Conditions ("Terms") govern your use of the SpeechGyms application operated by DeFiner Tech Ltd ("we", "our", "us").</p>

      <h2 className="text-lg font-bold text-white pt-4">1. Acceptance of Terms</h2>
      <p>By accessing or using SpeechGyms, you agree to be bound by these Terms. If you do not agree, you may not use the Service.</p>

      <h2 className="text-lg font-bold text-white pt-4">2. Description of Service</h2>
      <p>SpeechGyms is an AI-powered speech coaching platform that provides speech analysis, feedback, and practice tools. The Service uses Google Gemini AI for speech processing.</p>

      <h2 className="text-lg font-bold text-white pt-4">3. User Accounts</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>You must sign in with a valid Google account to access full features</li>
        <li>You are responsible for maintaining the security of your account</li>
        <li>You must be at least 13 years old to use the Service</li>
      </ul>

      <h2 className="text-lg font-bold text-white pt-4">4. Subscriptions & Payments</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Free users have limited access to analysis features</li>
        <li>Pro subscriptions are available on monthly ($9.90/month) or yearly ($59.90/year) plans</li>
        <li>New subscribers receive a 7-day free trial</li>
        <li>Subscriptions auto-renew unless cancelled before the end of the billing period</li>
        <li>You may cancel your subscription at any time through the Stripe billing portal</li>
        <li>Refunds are handled on a case-by-case basis; contact us for assistance</li>
        <li>Trial codes may be offered at our discretion and are subject to availability</li>
      </ul>

      <h2 className="text-lg font-bold text-white pt-4">5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Use the Service for any unlawful purpose</li>
        <li>Upload harmful, abusive, or inappropriate content</li>
        <li>Attempt to reverse engineer, hack, or disrupt the Service</li>
        <li>Share or resell your account access</li>
        <li>Abuse trial codes or create multiple accounts to obtain free trials</li>
      </ul>

      <h2 className="text-lg font-bold text-white pt-4">6. Intellectual Property</h2>
      <p>The Service, including its design, code, and AI models, is owned by DeFiner Tech Ltd. Your speech recordings remain your property. AI-generated analysis and model answers are provided for your personal use only.</p>

      <h2 className="text-lg font-bold text-white pt-4">7. AI Disclaimer</h2>
      <p>SpeechGyms uses artificial intelligence to analyze and provide feedback on your speech. AI analysis is provided for educational purposes and may not always be accurate. We do not guarantee specific outcomes or improvements.</p>

      <h2 className="text-lg font-bold text-white pt-4">8. Limitation of Liability</h2>
      <p>To the maximum extent permitted by law, DeFiner Tech Ltd shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>

      <h2 className="text-lg font-bold text-white pt-4">9. Termination</h2>
      <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, with or without notice.</p>

      <h2 className="text-lg font-bold text-white pt-4">10. Changes to Terms</h2>
      <p>We may modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

      <h2 className="text-lg font-bold text-white pt-4">11. Governing Law</h2>
      <p>These Terms are governed by and construed in accordance with the laws of Hong Kong SAR.</p>

      <h2 className="text-lg font-bold text-white pt-4">12. Contact Us</h2>
      <p>For questions about these Terms, contact us:</p>
      <p><strong className="text-white">DeFiner Tech Ltd</strong><br />
      Email: <a href="mailto:info@definertech.com" className="text-blue-400 hover:underline">info@definertech.com</a></p>
    </main>
  </div>
);
