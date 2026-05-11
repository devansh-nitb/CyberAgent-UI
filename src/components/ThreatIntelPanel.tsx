"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThreatItem {
  title: string;
  pubDate: string;
  link: string;
  categories: string[];
}

export default function ThreatIntelPanel() {
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const fetchLiveThreats = async () => {
      try {
        const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://feeds.feedburner.com/TheHackersNews');
        const data = await res.json();
        if (data.items) {
          setThreats(data.items.slice(0, 9)); // Get 9 items for 3 pages
        }
      } catch (err) {
        console.error("Failed to fetch live threat intel", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLiveThreats();
  }, []);

  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    if (threats.length === 0 || userInteracted) return;
    const interval = setInterval(() => {
      setPage(p => (p + 1) % Math.ceil(threats.length / 3));
    }, 8000); // Slide every 8 seconds
    return () => clearInterval(interval);
  }, [threats, userInteracted]);

  const totalPages = Math.ceil(threats.length / 3);
  const currentThreats = threats.slice(page * 3, page * 3 + 3);

  const nextPage = () => {
    setUserInteracted(true);
    setPage((p) => (p + 1) % totalPages);
  };

  const prevPage = () => {
    setUserInteracted(true);
    setPage((p) => (p - 1 + totalPages) % totalPages);
  };

  return (
    <div className="glass-panel p-6 h-full max-h-[600px] flex flex-col overflow-hidden">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-neon-red">{"//"}</span> Live Global Intel
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 items-center">
            <button onClick={prevPage} className="px-1 text-gray-500 hover:text-white transition-colors">&lt;</button>
            {[0, 1, 2].map(idx => (
              <div 
                key={idx} 
                className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === page ? 'bg-red-500' : 'bg-gray-500/30'}`}
              />
            ))}
            <button onClick={nextPage} className="px-1 text-gray-500 hover:text-white transition-colors">&gt;</button>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>
      </h2>
      
      <div className="flex-1 relative">
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-lg border" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}></div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-4 absolute inset-0"
            >
              {currentThreats.map((threat, i) => (
                <div 
                  key={i} 
                  className="p-4 rounded-lg border hover:border-primary transition-all group"
                  style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-red-500/20 text-red-500 border border-red-500/30">
                      {threat.categories?.[0] || 'Vulnerability'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
                      {new Date(threat.pubDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--foreground)' }}>{threat.title}</p>
                  <a 
                    href={threat.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-neon-blue flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                  >
                    Read Advisory →
                  </a>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
