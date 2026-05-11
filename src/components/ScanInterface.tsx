"use client";

import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

interface ScanInterfaceProps {
  onScanStart: (id: string) => void;
  isScanning?: boolean;
  onStopScan?: () => void;
  activeScanId?: string | null;
}

export default function ScanInterface({ onScanStart, isScanning, onStopScan, activeScanId }: ScanInterfaceProps) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stopping, setStopping] = useState(false);

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return !!parsed.hostname && parsed.hostname.includes('.');
    } catch {
      return false;
    }
  };

  const handleScan = async () => {
    if (!target) return;
    setError('');

    // Validate URL format
    if (!isValidUrl(target)) {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setLoading(true);

    // Check if the website is reachable
    try {
      const normalizedUrl = target.startsWith('http') ? target : `https://${target}`;
      await axios.get(normalizedUrl, { timeout: 8000 }).catch(() => {
        // Try via our backend proxy to avoid CORS
      });
    } catch {
      // Don't block — some sites block HEAD/GET from browsers due to CORS
    }

    try {
      const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${url}/api/scan`, { target });
      if (res.data.scanId) {
        onScanStart(res.data.scanId);
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 400) {
        setError(err.response.data.error || 'Invalid target. Please check the URL and try again.');
      } else {
        setError('Failed to connect to the analysis server. Please ensure all services are running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (!activeScanId) return;
    setStopping(true);
    try {
      const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      await axios.post(`${url}/api/scan/${activeScanId}/cancel`);
      if (onStopScan) onStopScan();
    } catch (err) {
      console.error('Failed to stop scan:', err);
      // Still reset the UI even if backend cancel fails
      if (onStopScan) onStopScan();
    } finally {
      setStopping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isScanning && !loading) {
      handleScan();
    }
  };

  return (
    <div className="glass-panel p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span className="text-neon-blue">{"//"}</span> New Security Scan
      </h2>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={target}
            onChange={(e) => { setTarget(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter target URL (e.g., https://example.com)"
            disabled={isScanning}
            className="flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--background)', borderColor: 'var(--panel-border)', color: 'var(--foreground)' }}
          />
          <div className="flex gap-2">
            <motion.button
              whileHover={!isScanning && !loading ? { scale: 1.02 } : {}}
              whileTap={!isScanning && !loading ? { scale: 0.98 } : {}}
              onClick={handleScan}
              disabled={loading || !target || isScanning}
              className="bg-neon-blue/10 border border-neon-blue text-neon-blue font-semibold px-8 py-3 rounded-lg hover:bg-neon-blue hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-neon-blue cursor-pointer"
            >
              {loading ? 'Validating...' : isScanning ? 'Analysis Running...' : 'Run AI Analysis'}
            </motion.button>

            <AnimatePresence>
              {isScanning && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.8, width: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStop}
                  disabled={stopping}
                  className="bg-red-500/10 border border-red-500 text-red-500 font-semibold px-6 py-3 rounded-lg hover:bg-red-500 hover:text-white transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {stopping ? 'Stopping...' : 'Stop Analysis'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
