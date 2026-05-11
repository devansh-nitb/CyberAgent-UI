"use client";

import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

interface Log {
  agent: string;
  message: string;
  timestamp: string;
}

export default function Terminal({ activeScanId }: { activeScanId: string | null }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeScanId) return;

    // Connect to WebSocket
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000');

    socket.on('scan-log', (data) => {
      if (data.scanId === activeScanId) {
        const msg = data.message;
        
        // Transform PROGRESS protocol messages into Phase labels
        if (msg.startsWith('PROGRESS:')) {
          const parts = msg.split(':');
          const completed = parseInt(parts[1]) || 0;
          const statusText = parts.slice(3).join(':');
          
          // Skip redundant pacing countdown messages (only show the first one per phase)
          if (statusText.includes('Pacing') && !statusText.includes('45s') && !statusText.includes('(45s)')) return;
          
          const phaseLabels: Record<number, string> = {
            0: 'System Initialization',
            1: 'Threat Intelligence Collection',
            2: 'Vulnerability Analysis & OWASP Mapping',
            3: 'Attack Path Simulation',
            4: 'Incident Response Planning',
            5: 'Report Compilation'
          };
          
          let displayMsg = '';
          if (statusText.includes('Warming up') || statusText.includes('Agents are now')) {
            displayMsg = 'Initializing CyberAgent agent pipeline...';
          } else if (statusText.includes('Pacing')) {
            displayMsg = `Phase ${completed} — ${phaseLabels[completed] || 'Processing'} - Complete. Cooling down before next phase...`;
          } else if (statusText.includes('finished') || statusText.includes('finalizing')) {
            displayMsg = 'All phases complete. Compiling final intelligence report...';
          } else {
            displayMsg = `Phase ${completed + 1} — ${phaseLabels[completed + 1] || statusText} in progress...`;
          }
          
          setLogs(prev => [...prev, {
            agent: `Phase ${completed}`,
            message: displayMsg,
            timestamp: new Date().toLocaleTimeString()
          }]);
        } else {
          // Pass through non-PROGRESS messages normally
          setLogs(prev => [...prev, {
            agent: data.agent,
            message: msg,
            timestamp: new Date().toLocaleTimeString()
          }]);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeScanId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="rounded-xl p-4 h-[400px] flex flex-col border border-gray-800 shadow-2xl" style={{ backgroundColor: '#050505' }}>
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-gray-500 font-mono ml-2">agent_activity_monitor.sh</span>
      </div>
      <div className="flex-1 overflow-y-auto terminal-scroll font-mono text-[14px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-gray-600 italic mt-2">Waiting for agent activity...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-2">
              <span className="text-gray-600">[{log.timestamp}]</span>{' '}
              <span className="text-red-500 font-bold">[{log.agent}]</span>{' '}
              <span className="text-emerald-400">{log.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
