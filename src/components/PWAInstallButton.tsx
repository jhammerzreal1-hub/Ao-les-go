import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

interface PWAInstallButtonProps {
  variant?: 'button' | 'menu';
  onAction?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  onAction,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
      if (onAction) onAction();
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    setShowBrowserGuide(true);
  };

  const buttonClass =
    variant === 'menu'
      ? 'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer'
      : 'flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer';

  const label = isInstallable ? 'Install App (PWA)' : isIOS ? 'Install on iOS' : 'PWA Ready';

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className={buttonClass}
        title="Install Lysander Genesis Orchestrator as a standalone PWA"
      >
        <span className="flex items-center gap-2">
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Download className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span className={variant === 'button' ? 'hidden sm:inline' : ''}>{label}</span>
        </span>
        {variant === 'menu' && (
          <span className="text-[10px] font-mono text-zinc-500">WebAPK</span>
        )}
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100">Install on iPhone / iPad</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              1. Tap the <strong>Share</strong> button in your Safari toolbar.<br /><br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {showBrowserGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100">Install Standalone App</h3>
              <button
                onClick={() => setShowBrowserGuide(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Open your browser menu (<strong>⋮</strong> or address bar install icon) and select{' '}
              <strong>Install app</strong> or <strong>Add to Home screen</strong> to launch Lysander Genesis Orchestrator standalone.
            </p>
            <button
              onClick={() => setShowBrowserGuide(false)}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
