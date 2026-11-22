import React, { useState } from 'react';
import { Send, Bot, User, HelpCircle, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { VehicleSnapshot, DiagnosticResult } from '../types';
import { currentFleetSession, reportIfFleetRefused } from '../services/fleetApi';

interface TechnicianCopilotProps {
  snapshot: VehicleSnapshot;
  result: DiagnosticResult | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const TechnicianCopilot: React.FC<TechnicianCopilotProps> = ({
  snapshot,
  result,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Master Technician Assistant online for Unit ${snapshot.vehicle_id}. Ask any technical questions regarding torque specifications, wiring pinouts, limp-mode feasibility, or shop diagnostic procedures.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestedQuestions = [
    'I hear a metallic grinding sound from the front left wheel when braking, what could it be?',
    'There is a high-pitched whistling noise from the turbo under load, what should I check?',
    'What is the installation torque spec for the NOx sensor?',
    'How do I verify if the coolant issue is a stuck thermostat vs head gasket?',
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    const userMessage: Message = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const fleetSession = currentFleetSession();
      const res = await fetch('/api/technical-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          snapshot,
          diagnosticResult: result,
        }),
      });

      if (await reportIfFleetRefused(res, fleetSession)) return; // the app replaces this panel with the refused view
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'No response available from diagnostic engine.',
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error contacting technician assistant: ${err?.message || 'Network error'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-display">
              Workshop AI Copilot
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              Live Q&A for Master Technicians & Shop Floor
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
          Unit: {snapshot.vehicle_id}
        </span>
      </div>

      {/* Message scroll container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2.5 ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/30">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`p-3 rounded-3xl max-w-[85%] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-amber-400 text-slate-950 font-medium rounded-tr-xl-none'
                  : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-xl-none font-sans whitespace-pre-wrap'
              }`}
            >
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-xl bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs p-2 bg-slate-950 rounded-2xl border border-slate-800 w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Consulting service manual & OEM wiring schematics...</span>
          </div>
        )}
      </div>

      {/* Suggested chips */}
      <div className="pt-2 pb-1">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1.5 font-mono">
          <HelpCircle className="w-3 h-3 text-amber-400" />
          <span>Quick queries:</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {suggestedQuestions.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleSend(sq)}
              className="text-[10px] px-2 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 shrink-0 transition-colors whitespace-nowrap"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-2 border-t border-slate-800"
      >
        <input
          type="text"
          placeholder="Ask about specific faults, weird sounds, or repair procedures..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold disabled:opacity-40 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
