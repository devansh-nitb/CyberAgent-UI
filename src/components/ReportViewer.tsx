"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';

interface Report {
  _id: string;
  target: string;
  status: string;
  riskScore: number;
  executiveSummary: string;
  vulnerabilities: { title: string; severity: string; description: string; cvss: number }[];
  threatIntelligence: string[];
  attackSimulation: string[];
  mitigationRecommendations: string[];
  evaluationMetrics?: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    max_cvss?: number;
    base_score?: number;
    penalty?: number;
    total_vulns?: number;
  };
}

export default function ReportViewer({ scanId, onComplete, onReset }: { scanId: string, onComplete?: () => void, onReset?: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(5);
  const [currentAction, setCurrentAction] = useState("Initializing CyberAgent Workflow...");
  const [expandedVulns, setExpandedVulns] = useState<number[]>([]);

  useEffect(() => {
    // Socket for real-time progress updates
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000');
    socket.on('scan-log', (data: any) => {
      if (data.scanId === scanId) {
        const msg = data.message;

        // Parse structured progress messages: "PROGRESS:completed:total:status text"
        if (msg.startsWith('PROGRESS:')) {
          const parts = msg.split(':');
          const completed = parseInt(parts[1]) || 0;
          const total = parseInt(parts[2]) || 5;
          const statusText = parts.slice(3).join(':');

          // Map progress: warmup phase = 5-15%, agents = 15-90%, finalize = 90-98%
          let pct: number;
          if (completed === 0) {
            // Warmup / pre-flight phase
            pct = statusText.includes('Agents are now') ? 15 : Math.min(5 + (10 * (1 - (parseInt(statusText.match(/\d+/)?.[0] || '60') / 60))), 14);
          } else if (completed >= total) {
            pct = 95;
          } else {
            // Each agent completion = ~15% progress within the 15-90 range
            const agentProgress = (completed / total) * 75;  // 75% range for agents
            pct = Math.min(15 + agentProgress, 90);

            // If it's a pacing message, add a small sub-step bump
            if (statusText.includes('Pacing')) {
              const remaining = parseInt(statusText.match(/(\d+)s\)/)?.[1] || '45');
              const pacingProgress = ((45 - remaining) / 45) * (75 / total);
              pct = Math.min(15 + agentProgress + pacingProgress, 90);
            }
          }

          setProgress(Math.round(pct));

          // Set human-readable action labels
          const agentLabels: Record<number, string> = {
            0: statusText.includes('Agents are now') ? 'Launching AI Agents...' : `Warming up engines... ${statusText.match(/\(\d+s\)/)?.[0] || ''}`,
            1: 'Threat Intel Agent gathering data...',
            2: 'Vulnerability Analyst mapping OWASP risks...',
            3: 'Red Team simulating attack vectors...',
            4: 'Incident Response developing mitigations...',
            5: 'Security Reporter compiling final report...'
          };

          if (statusText.includes('Pacing')) {
            setCurrentAction(`${statusText}`);
          } else if (statusText.includes('finished') || statusText.includes('finalizing')) {
            setCurrentAction('All agents finished. Finalizing report...');
          } else {
            setCurrentAction(agentLabels[completed] || statusText);
          }
        }
        // Handle legacy messages
        else if (msg.includes('Starting task:')) {
          setCurrentAction(`${data.agent || 'Agent'} is working...`);
        }
        else if (msg.includes('Task completed')) {
          setCurrentAction(`${data.agent || 'Agent'} finished.`);
        }
        else if (msg.includes('Analysis complete')) { setProgress(98); setCurrentAction("Parsing and finalizing report..."); }
      }
    });

    let interval: NodeJS.Timeout;
    const fetchReport = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
        const res = await axios.get(`${url.replace('localhost', '127.0.0.1')}/api/scan/${scanId}`, {
          params: { t: Date.now() }
        });
        setReport(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          setLoading(false);
          clearInterval(interval);
          socket.disconnect();
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchReport();
    interval = setInterval(fetchReport, 3000);
    return () => { clearInterval(interval); socket.disconnect(); };
  }, [scanId]);

  useEffect(() => {
    if (!loading && report && report.status === 'completed' && onComplete) {
      onComplete();
    }
  }, [loading, report, onComplete]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-10 mt-6 relative overflow-hidden"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 rounded-full border-t-2 border-r-2 animate-spin" style={{ borderColor: 'var(--accent-primary)' }} />
            <h3 className="text-xl font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
              AI Agents Compiling Threat Report...
            </h3>
          </div>

          <div className="w-full max-w-xl rounded-full h-2 overflow-hidden border" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
            <motion.div
              className="h-full"
              style={{ background: 'var(--accent-primary)' }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          <div className="flex justify-between w-full max-w-xl text-xs font-mono text-gray-500">
            <span className="text-neon-blue animate-pulse">{currentAction}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!report || report.status !== 'completed') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-8 mt-6"
      style={{ borderColor: 'var(--panel-border)' }}
    >
      {onReset && (
        <button
          onClick={onReset}
          className="mb-6 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-all duration-300 no-print font-semibold cursor-pointer px-5 py-2 rounded-full border border-gray-600 hover:border-gray-400 hover:bg-white/5 hover:shadow-[0_0_12px_rgba(255,255,255,0.08)]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Dashboard
        </button>
      )}

      <div className="flex justify-between items-start mb-8 pb-6 border-b" style={{ borderColor: 'var(--panel-border)' }}>
        <div>
          <h2 className="text-3xl font-bold mb-2">Security Analysis Report</h2>
          <p style={{ color: 'var(--foreground)', opacity: 0.7 }}>Target: <span className="font-mono ml-2 font-bold" style={{ color: 'var(--foreground)', opacity: 1 }}>{report.target}</span></p>
        </div>
        <div className="text-right">
          <div className="text-sm uppercase tracking-widest mb-1" style={{ color: 'var(--foreground)', opacity: 0.5 }}>Risk Score</div>
          <div className={`text-5xl font-bold ${report.riskScore >= 75 ? 'text-red-500' :
              report.riskScore >= 50 ? 'text-orange-500' : 'text-emerald-500'
            }`}>
            {report.riskScore}<span className="text-2xl" style={{ color: 'var(--foreground)', opacity: 0.3 }}>/100</span>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><span className="text-neon-purple">{"//"}</span> Executive Summary</h3>
          <p className="leading-relaxed p-4 rounded-lg border break-words" style={{ background: 'var(--background)', borderColor: 'var(--panel-border)', color: 'var(--foreground)' }}>
            {report.executiveSummary}
          </p>
        </section>

        {/* Risk Score Breakdown - Transparent Scoring */}
        {report.evaluationMetrics && (
          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><span className="text-neon-purple">{"//"}</span> Risk Score Breakdown</h3>
            <div className="p-5 rounded-lg border" style={{ background: 'var(--background)', borderColor: 'var(--panel-border)' }}>
              {(() => {
                const m = report.evaluationMetrics!;
                const maxCvss = m.max_cvss ?? 0;
                const baseScore = m.base_score ?? Math.round((maxCvss / 10) * 70 * 10) / 10;
                const penalty = m.penalty ?? 0;
                const scoreColor = report.riskScore >= 75 ? '#ef4444' : report.riskScore >= 50 ? '#f97316' : report.riskScore >= 30 ? '#eab308' : '#22c55e';

                // Calculate individual penalty contributions for display
                const critPenalty = maxCvss >= 9.0 ? Math.max(0, m.critical_count - 1) * 8 : 0;
                const highPenalty = maxCvss >= 9.0 ? m.high_count * 5 : (maxCvss >= 7.0 ? Math.max(0, m.high_count - 1) * 5 : 0);
                const medPenalty = (maxCvss >= 9.0 || maxCvss >= 7.0) ? m.medium_count * 2 : (maxCvss >= 4.0 ? Math.max(0, m.medium_count - 1) * 2 : 0);
                const lowPenalty = (maxCvss >= 4.0 || maxCvss >= 7.0 || maxCvss >= 9.0) ? m.low_count * 0.5 : (maxCvss > 0 ? Math.max(0, m.low_count - 1) * 0.5 : 0);

                return (
                  <div className="space-y-5">
                    {/* Score Visual */}
                    <div className="flex items-center gap-6">
                      <div className="text-5xl font-bold" style={{ color: scoreColor }}>
                        {report.riskScore}<span className="text-xl" style={{ color: 'var(--foreground)', opacity: 0.3 }}>/100</span>
                      </div>
                      <div className="flex-1">
                        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--panel-bg)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${report.riskScore}%`, background: `linear-gradient(90deg, ${scoreColor}88, ${scoreColor})` }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] font-mono" style={{ color: 'var(--foreground)', opacity: 0.4 }}>
                          <span>0 — Safe</span><span>30 — Low</span><span>50 — Medium</span><span>75 — High</span><span>100 — Critical</span>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-step math */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Step 1: Anchor */}
                      <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--foreground)', opacity: 0.4 }}>Step 1 — CVSS Anchor Score</div>
                        <div className="text-sm mb-2" style={{ color: 'var(--foreground)', opacity: 0.8 }}>
                          Highest CVSS found: <span className="font-bold" style={{ color: scoreColor }}>{maxCvss}</span> / 10.0
                        </div>
                        <div className="font-mono text-sm p-2 rounded" style={{ background: 'var(--background)' }}>
                          <span style={{ color: 'var(--foreground)', opacity: 0.5 }}>Formula:</span> ({maxCvss} / 10) × 70 = <span className="font-bold" style={{ color: scoreColor }}>{baseScore}</span>
                        </div>
                        <p className="text-[11px] mt-2" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
                          The worst vulnerability&apos;s CVSS score determines up to 70% of the total risk.
                        </p>
                      </div>

                      {/* Step 2: Penalty Breakdown */}
                      <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-bg)' }}>
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--foreground)', opacity: 0.4 }}>Step 2 — Cumulative Penalty (+{Math.min(penalty, 30)} pts)</div>
                        <div className="space-y-1.5 text-sm">
                          {m.critical_count > 0 && (
                            <div className="flex justify-between">
                              <span className="text-red-500">Critical × {m.critical_count}</span>
                              <span className="font-mono font-bold text-red-400">+{critPenalty}</span>
                            </div>
                          )}
                          {m.high_count > 0 && (
                            <div className="flex justify-between">
                              <span className="text-orange-500">High × {m.high_count}</span>
                              <span className="font-mono font-bold text-orange-400">+{highPenalty}</span>
                            </div>
                          )}
                          {m.medium_count > 0 && (
                            <div className="flex justify-between">
                              <span className="text-yellow-500">Medium × {m.medium_count}</span>
                              <span className="font-mono font-bold text-yellow-400">+{medPenalty}</span>
                            </div>
                          )}
                          {m.low_count > 0 && (
                            <div className="flex justify-between">
                              <span className="text-green-500">Low × {m.low_count}</span>
                              <span className="font-mono font-bold text-green-400">+{lowPenalty}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] mt-2" style={{ color: 'var(--foreground)', opacity: 0.5 }}>
                          Additional vulnerabilities add up to 30 penalty points max.
                        </p>
                      </div>
                    </div>

                    {/* Final Calculation */}
                    <div className="p-3 rounded-lg border-2 font-mono text-center" style={{ borderColor: scoreColor, background: `${scoreColor}08` }}>
                      <span style={{ color: 'var(--foreground)', opacity: 0.6 }}>Final Score = </span>
                      <span className="font-bold">{baseScore}</span>
                      <span style={{ color: 'var(--foreground)', opacity: 0.4 }}> (anchor) </span>
                      <span className="font-bold">+ {Math.min(penalty, 30)}</span>
                      <span style={{ color: 'var(--foreground)', opacity: 0.4 }}> (penalties) </span>
                      <span style={{ color: 'var(--foreground)', opacity: 0.6 }}> = </span>
                      <span className="text-lg font-bold" style={{ color: scoreColor }}>{report.riskScore} / 100</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><span className="text-neon-purple">{"//"}</span> Vulnerabilities Identified</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.vulnerabilities.map((v, i) => {
              const isExpanded = expandedVulns.includes(i);
              const cvssNum = typeof v.cvss === 'object' ? (v.cvss as any).score || 0 : (typeof v.cvss === 'number' ? v.cvss : parseFloat(String(v.cvss)) || 0);
              const cvssColor = cvssNum >= 9 ? '#ef4444' : cvssNum >= 7 ? '#f97316' : cvssNum >= 4 ? '#eab308' : '#22c55e';
              const cvssLabel = cvssNum >= 9 ? 'Critical' : cvssNum >= 7 ? 'High' : cvssNum >= 4 ? 'Medium' : 'Low';

              // Generate contextual remediation based on vulnerability title keywords
              const titleLower = (v.title || '').toLowerCase();
              const getRemediation = () => {
                if (titleLower.includes('sql injection') || titleLower.includes('sqli')) return ['Use parameterized queries / prepared statements', 'Implement input validation and sanitization', 'Apply Web Application Firewall (WAF) rules', 'Adopt an ORM to abstract direct SQL queries'];
                if (titleLower.includes('xss') || titleLower.includes('cross-site scripting')) return ['Sanitize and encode all user-supplied output', 'Implement Content Security Policy (CSP) headers', 'Use HTTPOnly and Secure cookie flags', 'Adopt a templating engine with auto-escaping'];
                if (titleLower.includes('ssrf') || titleLower.includes('request forgery')) return ['Validate and whitelist allowed URLs/IPs', 'Block requests to internal/private IP ranges', 'Implement network segmentation', 'Use allowlists instead of denylists for URL validation'];
                if (titleLower.includes('auth') || titleLower.includes('credential') || titleLower.includes('password') || titleLower.includes('default')) return ['Enforce strong password policies and MFA', 'Remove or disable default credentials', 'Implement account lockout after failed attempts', 'Use secure session management with token rotation'];
                if (titleLower.includes('deseriali')) return ['Avoid deserializing untrusted data', 'Use safe serialization formats (JSON instead of binary)', 'Implement integrity checks on serialized data', 'Apply strict type constraints during deserialization'];
                if (titleLower.includes('crypto') || titleLower.includes('hash') || titleLower.includes('encrypt')) return ['Upgrade to SHA-256 or bcrypt for password hashing', 'Use TLS 1.3 for data in transit', 'Rotate encryption keys regularly', 'Avoid deprecated algorithms (MD5, SHA-1, DES)'];
                if (titleLower.includes('misconfig') || titleLower.includes('config')) return ['Harden server and framework configurations', 'Disable unnecessary features, ports, and services', 'Implement automated configuration auditing', 'Follow CIS Benchmarks for your tech stack'];
                if (titleLower.includes('dependency') || titleLower.includes('npm') || titleLower.includes('supply chain') || titleLower.includes('outdated')) return ['Audit dependencies with npm audit / Snyk', 'Pin dependency versions with lock files', 'Enable automated dependency update tools (Dependabot)', 'Verify package integrity via checksums'];
                return ['Apply vendor-recommended patches immediately', 'Implement defense-in-depth controls', 'Monitor for exploitation attempts in logs', 'Conduct regular penetration testing'];
              };

              const getImpact = () => {
                if (cvssNum >= 9) return 'Complete system compromise possible. Attacker may gain full control over the application, access all sensitive data, and pivot to internal infrastructure.';
                if (cvssNum >= 7) return 'Significant risk of data breach or unauthorized access. Exploitation could lead to privilege escalation or access to sensitive resources.';
                if (cvssNum >= 4) return 'Moderate risk. Exploitation may expose partial information or enable limited unauthorized actions within the application.';
                return 'Low risk. Exploitation requires specific conditions and has limited direct impact on confidentiality, integrity, or availability.';
              };

              const getOwaspRef = () => {
                if (titleLower.includes('injection') || titleLower.includes('sqli')) return { id: 'A03:2021', name: 'Injection', url: 'https://owasp.org/Top10/A03_2021-Injection/' };
                if (titleLower.includes('xss') || titleLower.includes('cross-site')) return { id: 'A03:2021', name: 'Injection (XSS)', url: 'https://owasp.org/Top10/A03_2021-Injection/' };
                if (titleLower.includes('auth') || titleLower.includes('credential') || titleLower.includes('password')) return { id: 'A07:2021', name: 'Identification & Authentication Failures', url: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/' };
                if (titleLower.includes('ssrf')) return { id: 'A10:2021', name: 'Server-Side Request Forgery', url: 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/' };
                if (titleLower.includes('misconfig') || titleLower.includes('config')) return { id: 'A05:2021', name: 'Security Misconfiguration', url: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' };
                if (titleLower.includes('crypto') || titleLower.includes('hash') || titleLower.includes('encrypt')) return { id: 'A02:2021', name: 'Cryptographic Failures', url: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/' };
                if (titleLower.includes('deseriali')) return { id: 'A08:2021', name: 'Software & Data Integrity Failures', url: 'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/' };
                if (titleLower.includes('dependency') || titleLower.includes('outdated') || titleLower.includes('component')) return { id: 'A06:2021', name: 'Vulnerable & Outdated Components', url: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' };
                return { id: 'A05:2021', name: 'Security Misconfiguration', url: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' };
              };

              const remediation = getRemediation();
              const impact = getImpact();
              const owasp = getOwaspRef();

              return (
                <div key={i} className="rounded-lg border transition-all duration-300 overflow-hidden relative" style={{ background: 'var(--background)', borderColor: isExpanded ? cvssColor : 'var(--panel-border)' }}>
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between mb-3 gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-lg leading-tight break-words">{v.title}</h4>
                      </div>
                      <span className={`px-2 py-1 text-[10px] rounded font-bold whitespace-nowrap shrink-0 border ${v.severity === 'Critical' || v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                          v.severity === 'High' || v.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                            v.severity === 'Medium' || v.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' :
                              'bg-green-500/20 text-green-500 border-green-500/30'
                        }`}>
                        CVSS: {cvssNum.toFixed(1)} | {v.severity}
                      </span>
                    </div>
                    <p className="text-sm mb-4 break-words leading-relaxed" style={{ color: 'var(--foreground)', opacity: 0.7 }}>{v.description}</p>
                    <button
                      onClick={() => setExpandedVulns(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      className="flex items-center gap-1.5 text-xs font-semibold transition-colors no-print"
                      style={{ color: cvssColor }}
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      {isExpanded ? 'Hide Details' : 'Show Detailed Analysis'}
                    </button>
                  </div>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-4 pb-4 space-y-4 border-t"
                      style={{ borderColor: 'var(--panel-border)' }}
                    >
                      {/* CVSS Visual Bar */}
                      <div className="pt-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--foreground)', opacity: 0.5 }}>CVSS SEVERITY SCALE</span>
                          <span className="text-sm font-bold" style={{ color: cvssColor }}>{cvssNum.toFixed(1)} / 10.0 — {cvssLabel}</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--panel-bg)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(cvssNum / 10) * 100}%`, background: cvssColor }} />
                        </div>
                      </div>

                      {/* OWASP Reference */}
                      <div className="p-3 rounded-lg border overflow-hidden" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-blue-500/20 text-blue-400 shrink-0">OWASP</span>
                          <span className="text-sm font-semibold truncate">{owasp.id} — {owasp.name}</span>
                        </div>
                        <a href={owasp.url} target="_blank" rel="noopener noreferrer" className="text-xs underline text-blue-400 hover:text-blue-300 transition-colors break-all block">{owasp.url}</a>
                      </div>

                      {/* Impact Assessment */}
                      <div>
                        <h5 className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
                          <span style={{ color: cvssColor }}>⚠</span> Impact Assessment
                        </h5>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)', opacity: 0.8 }}>{impact}</p>
                      </div>

                      {/* Contextual Remediation */}
                      <div>
                        <h5 className="text-sm font-semibold mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-emerald-400">🛡</span> 
                          <span>Recommended Remediation for</span> 
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 break-all" style={{ color: 'var(--foreground)', opacity: 0.8 }}>{report.target}</span>
                        </h5>
                        <div className="space-y-1.5">
                          {remediation.map((step, si) => (
                            <div key={si} className="flex items-start gap-2 text-sm" style={{ color: 'var(--foreground)', opacity: 0.8 }}>
                              <span className="text-emerald-400 font-bold text-xs mt-0.5">{si + 1}.</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><span className="text-neon-red">{"//"}</span> Attack Simulation</h3>
            <ul className="space-y-3">
              {report.attackSimulation.map((step, i) => (
                <li key={i} className="flex gap-3 break-words" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <span className="text-neon-red font-mono shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><span className="text-neon-green">{"//"}</span> Mitigation Recommendations</h3>
            <ul className="space-y-3">
              {report.mitigationRecommendations.map((rec, i) => (
                <li key={i} className="flex gap-3 break-words" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
                  <span className="text-neon-green font-mono shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Next Level Recruiter Feature: Visual Attack Surface Map */}
        <section id="attack-surface-map" className="mt-8 border rounded-lg p-6" style={{ background: 'var(--background)', borderColor: 'var(--panel-border)' }}>
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-neon-blue">{"//"}</span> Attack Surface Map
          </h3>
          <div className="flex gap-8 items-center justify-center p-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full border-2 border-neon-blue flex items-center justify-center bg-neon-blue/10">🌐</div>
              <span className="text-xs font-mono">{new URL(report.target).hostname}</span>
            </div>
            <div className="h-0.5 w-16 relative" style={{ backgroundColor: 'var(--panel-border)' }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 rotate-45" style={{ borderColor: 'var(--panel-border)' }}></div>
            </div>
            <div className="flex flex-col gap-4">
              {report.vulnerabilities.slice(0, 3).map((v, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 rounded border relative" style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
                  <div className="absolute -left-6 top-1/2 w-6 h-0.5" style={{ backgroundColor: 'var(--panel-border)' }}></div>
                  <div className={`w-3 h-3 rounded-full ${v.severity === 'Critical' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : v.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm font-mono">{v.title.substring(0, 30)}...</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t flex flex-wrap gap-4 justify-end no-print" style={{ borderColor: 'var(--panel-border)' }}>
        <button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
            const a = document.createElement('a');
            a.href = dataStr;
            a.download = `CyberAgent_Intelligence_Report_${scanId}.json`;
            a.click();
          }}
          className="bg-gray-800 text-white font-semibold px-4 py-2 rounded-lg transition-transform hover:scale-105 border border-gray-600"
        >
          Export JSON
        </button>

        <button
          onClick={() => {
            let txt = `CyberAgent - Cybersecurity Yield Breach Evaluation & Risk Assessment\n========================================================================\n\nTarget: ${report.target}\nRisk Score: ${report.riskScore}/100\n\nExecutive Summary:\n${report.executiveSummary}\n\n`;
            txt += `Vulnerabilities:\n`;
            report.vulnerabilities.forEach((v, i) => { txt += `${i + 1}. ${v.title} [CVSS: ${v.cvss}]\n   ${v.description}\n`; });
            txt += `\nAttack Simulation:\n`;
            report.attackSimulation.forEach((s, i) => { txt += `${i + 1}. ${s}\n`; });
            txt += `\nMitigations:\n`;
            report.mitigationRecommendations.forEach((m, i) => { txt += `${i + 1}. ${m}\n`; });

            const a = document.createElement('a');
            a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(txt);
            a.download = `CyberAgent_Intelligence_Report_${scanId}.txt`;
            a.click();
          }}
          className="bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg transition-transform hover:scale-105 border border-gray-500"
        >
          Export TXT
        </button>

        <button
          onClick={async () => {
            const jsPDFModule = await import('jspdf');
            const autoTableModule = await import('jspdf-autotable');
            const html2canvasModule = await import('html2canvas');
            const doc = new jsPDFModule.default() as any;
            const autoTable = autoTableModule.default;
            const html2canvas = html2canvasModule.default;

            const metrics = report.evaluationMetrics || { critical_count: 0, high_count: 0, medium_count: 0, low_count: 0 };

            // === PAGE 1: TITLE & SUMMARY ===
            doc.setFontSize(22);
            doc.setTextColor(200, 0, 0);
            doc.text("CyberAgent - Official Intelligence Report", 14, 20);

            // Emphasized Risk Score
            doc.setFontSize(14);
            doc.setTextColor(220, 38, 38);
            doc.text(`Overall Risk Score: ${report.riskScore} / 100`, 14, 32);

            doc.setFontSize(11);
            doc.setTextColor(50, 50, 50);
            doc.text(`Target: ${report.target}`, 14, 42);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 48);

            // === EVALUATION METRICS TABLE ===
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("Risk Evaluation Metrics", 14, 62);

            autoTable(doc, {
              startY: 67,
              head: [['Scoring Component', 'Count', 'Calculation Method', 'Impact']],
              body: [
                ['Base CVSS Anchor', '1 (Highest)', '(Max CVSS / 10) * 70', 'Primary Logic'],
                ['Additional Critical', Math.max(0, metrics.critical_count - 1).toString(), '+8 per extra vuln', 'Penalty'],
                ['Additional High', (metrics.high_count > 0 && metrics.critical_count == 0) ? Math.max(0, metrics.high_count - 1).toString() : metrics.high_count.toString(), '+5 per extra vuln', 'Penalty'],
                ['Additional Medium', (metrics.medium_count > 0 && metrics.critical_count == 0 && metrics.high_count == 0) ? Math.max(0, metrics.medium_count - 1).toString() : metrics.medium_count.toString(), '+2 per extra vuln', 'Penalty'],
                ['Additional Low', (metrics.low_count > 0 && metrics.critical_count == 0 && metrics.high_count == 0 && metrics.medium_count == 0) ? Math.max(0, metrics.low_count - 1).toString() : metrics.low_count.toString(), '+0.5 per extra vuln', 'Penalty'],
                ['TOTAL RISK SCORE', '', 'Base + Penalties (Capped at 100)', `${report.riskScore} / 100`]
              ],
              styles: { fontSize: 9, cellPadding: 3 },
              headStyles: { fillColor: [50, 50, 50] },
              bodyStyles: { textColor: [30, 30, 30] },
              alternateRowStyles: { fillColor: [245, 245, 245] },
            });

            let finalY = doc.lastAutoTable.finalY + 12;

            // === EXECUTIVE SUMMARY ===
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("Executive Summary", 14, finalY);
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            const splitSummary = doc.splitTextToSize(report.executiveSummary, 180);
            finalY += 7;
            doc.text(splitSummary, 14, finalY);
            finalY += splitSummary.length * 5 + 10;

            // === VULNERABILITIES TABLE ===
            if (finalY > 240) { doc.addPage(); finalY = 20; }
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("Identified Vulnerabilities", 14, finalY);

            autoTable(doc, {
              startY: finalY + 5,
              head: [['Title', 'Severity', 'CVSS', 'Description']],
              body: report.vulnerabilities.map((v: any) => [v.title, v.severity, v.cvss.toString(), v.description]),
              styles: { fontSize: 9, cellPadding: 3 },
              headStyles: { fillColor: [200, 0, 0] },
              columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 20 }, 2: { cellWidth: 15 }, 3: { cellWidth: 'auto' } }
            });

            // === ATTACK SIMULATION ===
            finalY = doc.lastAutoTable.finalY + 15;
            if (finalY > 250) { doc.addPage(); finalY = 20; }
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("Attack Simulation Path", 14, finalY);
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            report.attackSimulation.forEach((sim: string, idx: number) => {
              finalY += 8;
              if (finalY > 280) { doc.addPage(); finalY = 20; }
              const text = doc.splitTextToSize(`${idx + 1}. ${sim}`, 180);
              doc.text(text, 14, finalY);
              finalY += (text.length - 1) * 5;
            });

            // === MITIGATION RECOMMENDATIONS ===
            finalY += 15;
            if (finalY > 250) { doc.addPage(); finalY = 20; }
            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("Mitigation Recommendations", 14, finalY);
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            report.mitigationRecommendations.forEach((rec: string, idx: number) => {
              finalY += 8;
              if (finalY > 280) { doc.addPage(); finalY = 20; }
              const text = doc.splitTextToSize(`${idx + 1}. ${rec}`, 180);
              doc.text(text, 14, finalY);
              finalY += (text.length - 1) * 5;
            });

            // === ATTACK SURFACE MAP (Screenshot) ===
            try {
              const mapEl = document.getElementById('attack-surface-map');
              if (mapEl) {
                const canvas = await html2canvas(mapEl, { backgroundColor: '#0a0a0a', scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                doc.addPage();
                doc.setFontSize(16);
                doc.setTextColor(0, 0, 0);
                doc.text("Attack Surface Map", 14, 20);
                const imgWidth = 180;
                const imgHeight = (canvas.height / canvas.width) * imgWidth;
                doc.addImage(imgData, 'PNG', 14, 28, imgWidth, Math.min(imgHeight, 230));
              }
            } catch (e) {
              console.warn('Could not capture attack surface map:', e);
            }

            doc.save(`Official_Threat_Report_${scanId}.pdf`);
          }}
          className="bg-neon-blue text-white font-bold px-6 py-2 rounded-lg transition-transform hover:scale-105 shadow-[0_0_15px_var(--accent-primary)]"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Download Official PDF
        </button>

        {onReset && (
          <button
            onClick={onReset}
            className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-lg transition-transform hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
          >
            Check Another Site
          </button>
        )}
      </div>
    </motion.div>
  );
}
