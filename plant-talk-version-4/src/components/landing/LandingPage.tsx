import React, { useState } from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingAbout } from './LandingAbout';
import { LandingCTA } from './LandingCTA';
import { LandingFooter } from './LandingFooter';
import { InstallModal } from './InstallModal';
import { GoogleLoginModal } from './GoogleLoginModal';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAuthStore } from '../../stores/auth-store';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const { triggerInstall, isInstalled, isIOS } = usePWAInstall();
  const { isAuthenticated } = useAuthStore();

  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [installStatus, setInstallStatus] = useState<
    'accepted' | 'dismissed' | 'unavailable' | 'already-installed' | 'prompted'
  >('unavailable');

  const handleInstallClick = async () => {
    // If user is already authenticated, allow them to proceed or install
    if (isInstalled) {
      setInstallStatus('already-installed');
      setInstallModalOpen(true);
      return;
    }

    try {
      const result = await triggerInstall();
      setInstallStatus(result.status);
      setInstallModalOpen(true);
    } catch {
      setInstallStatus('unavailable');
      setInstallModalOpen(true);
    }
  };

  const handleContinueToLogin = () => {
    setInstallModalOpen(false);
    if (isAuthenticated) {
      onEnterApp();
    } else {
      setLoginModalOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    setLoginModalOpen(false);
    onEnterApp();
  };

  return (
    <div className="relative min-h-screen w-full bg-[#fbfdfa] text-stone-900 font-sans selection:bg-emerald-500/20 selection:text-emerald-900 overflow-x-hidden overflow-y-auto scroll-smooth">
      
      {/* 1. Header (No Home, No Get Started) */}
      <LandingHeader 
        onInstallClick={handleInstallClick}
        onEnterApp={onEnterApp}
      />

      {/* Main Landing Page Content */}
      <main className="w-full">
        {/* 2. Hero Section */}
        <LandingHero onInstallClick={handleInstallClick} />

        {/* 3. Features Section */}
        <LandingFeatures />

        {/* 4. How It Works Section */}
        <LandingHowItWorks />

        {/* 5. About The Project */}
        <LandingAbout />

        {/* 6. Call To Action (No Get Started or secondary install buttons) */}
        <LandingCTA />
      </main>

      {/* 7. Footer (No Home or Get Started) */}
      <LandingFooter />

      {/* Modal: PWA Installation Guidance */}
      <InstallModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        onContinueToLogin={handleContinueToLogin}
        installStatus={installStatus}
        isIOS={isIOS}
      />

      {/* Modal: Google Authentication */}
      <GoogleLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

    </div>
  );
};
