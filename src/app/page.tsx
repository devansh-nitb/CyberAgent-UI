"use client";

import { useState } from 'react';
import ScanInterface from '@/components/ScanInterface';
import Terminal from '@/components/Terminal';
import ThreatIntelPanel from '@/components/ThreatIntelPanel';
import ReportViewer from '@/components/ReportViewer';
import NetworkBackground from '@/components/NetworkBackground';

export default function Dashboard() {
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [isLightMode, setIsLightMode] = useState(false);
  const [reportCompleted, setReportCompleted] = useState(false);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    if (!isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  return (
    <div 
      className={`min-h-screen ${isLightMode ? 'light' : ''} transition-colors duration-300 relative flex flex-col`}
      style={{ color: 'var(--foreground)', backgroundColor: 'var(--background)' }}
    >
      <NetworkBackground />
      
      {/* Amazing Full-Width Header */}
      <header className="w-full border-b backdrop-blur-md sticky top-0 z-50 no-print" style={{ borderColor: 'var(--panel-border)', backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}>
        <div className="w-full px-6 lg:px-12 py-4 flex justify-between items-center mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl shadow-[0_0_15px_var(--accent-primary)]" style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}>
              CA
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Cyber<span style={{ color: 'var(--accent-primary)' }}>Agent</span>
              </h1>
              <p className="text-[10px] tracking-widest uppercase mt-1 font-mono" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                Cybersecurity Yield Breach Evaluation & Risk Assessment - Governance Intelligence Network Technology
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleTheme}
              className="text-xs px-4 py-2 rounded-full border transition-colors hover:bg-gray-800/20 font-bold tracking-wider"
              style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}
            >
              {isLightMode ? '🌙 DARK THEME' : '☀️ LIGHT THEME'}
            </button>
            <div className="hidden md:flex items-center gap-2 bg-black/20 px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--panel-border)' }}>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px_#10b981] bg-emerald-500" />
              <span className="text-xs font-mono tracking-wider" style={{ color: 'var(--foreground)', opacity: 0.9 }}>SYSTEM SECURE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Full-Width Content Area */}
      <main className="flex-1 w-full px-6 lg:px-12 py-8 mx-auto relative z-10 flex flex-col gap-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 flex flex-col gap-8">
            {!reportCompleted && (
              <div className="no-print">
                <ScanInterface 
                  onScanStart={(id) => { setActiveScanId(id); setReportCompleted(false); }} 
                  isScanning={!!activeScanId && !reportCompleted}
                  activeScanId={activeScanId}
                  onStopScan={() => { setActiveScanId(null); setReportCompleted(false); }}
                />
              </div>
            )}
            
            {activeScanId && (
              <ReportViewer 
                scanId={activeScanId} 
                onComplete={() => setReportCompleted(true)}
                onReset={() => { setActiveScanId(null); setReportCompleted(false); }}
              />
            )}

            {!reportCompleted && (
              <div className="no-print">
                <Terminal activeScanId={activeScanId} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-8 no-print h-full">
            <ThreatIntelPanel />
          </div>
        </div>
      </main>

      {/* Amazing Footer */}
      <footer className="w-full border-t backdrop-blur-md mt-auto z-50 no-print" style={{ borderColor: 'var(--panel-border)', backgroundColor: 'var(--panel-bg)' }}>
        <div className="w-full px-6 lg:px-12 py-3 flex justify-between items-center text-xs font-mono">
          <div className="flex items-center gap-4">
            <span style={{ color: 'var(--foreground)', opacity: 0.5 }}>© 2026 CyberAgent - DEVANSH</span>
            <span style={{ color: 'var(--foreground)', opacity: 0.5 }}>|</span>
            <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground)', opacity: 0.8 }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Global Relays Connected
            </span>
          </div>
          <div className="flex gap-6" style={{ color: 'var(--foreground)', opacity: 0.6 }}>
            <span>Lat: 12ms</span>
            <span>Uptime: 99.99%</span>
            <span>Admin: Devansh</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
