import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Share2,
  Cpu,
  Radio,
  Server,
  Database,
  Sparkles,
  Monitor,
  Activity,
  Layers,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Info,
  ChevronRight,
  RefreshCw,
  Gauge
} from 'lucide-react';

export type ArchitectureLayer = 'all' | 'edge' | 'cloud' | 'app' | 'network';

interface ArchitectureNode {
  id: string;
  label: string;
  layer: 'edge' | 'cloud' | 'app' | 'network';
  layerName: string;
  icon: React.ComponentType<{ className?: string }>;
  protocol: string;
  latency: string;
  throughput: string;
  description: string;
  telematicsRole: string;
  samplePayload: Record<string, any>;
  hardwareOrTech: string[];
}

const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: 'sensors',
    label: 'Vehicle Sensors (Edge)',
    layer: 'edge',
    layerName: 'Edge Layer',
    icon: Gauge,
    protocol: 'SAE J1939 CAN-Bus (250 / 500 kbps)',
    latency: '< 5 ms',
    throughput: '100+ frames/sec',
    description: 'Hardware transducers across powertrain, exhaust DPF/SCR, transmission, braking, and tire TPMS reporting physical parameters continuously.',
    telematicsRole: 'Physical parameter measurement, analog-to-digital signal sampling, and transmission over dual-wire twisted CAN High/Low bus.',
    hardwareOrTech: ['NOx Sensors', 'Coolant Temp Sender', 'DPF Differential Pressure', 'Wheel Speed Hall Sensors', 'TPMS 433MHz Transmitters'],
    samplePayload: {
      can_id: '0x18FEEE00',
      pgn: 65262,
      source_address: '0x00 (Engine #1)',
      data_hex: '68 7A FF 82 FF FF FF FF',
      decoded: {
        engine_coolant_temp_c: 88,
        engine_oil_temp_c: 94,
        fuel_temp_c: 32
      }
    }
  },
  {
    id: 'gateway',
    label: 'IoT Gateway (Edge)',
    layer: 'edge',
    layerName: 'Edge Layer',
    icon: Cpu,
    protocol: 'ISO 14229 UDS / OBD-II J1979 / CAN 2.0B',
    latency: '8 - 15 ms',
    throughput: 'Dual CAN channels + RS485',
    description: 'On-board Telematics Control Unit (TCU) that aggregates CAN frames, filters noise, checks fault thresholds, and buffers records during cellular drops.',
    telematicsRole: 'Local edge compute, parsing raw broadcast PGNs, extracting Diagnostic Trouble Codes (DTCs), cryptographic signing, and flash ring-buffer queuing.',
    hardwareOrTech: ['ARM Cortex-M4 MCU', 'Dual CAN Transceivers', 'eMMC Local Flash Buffer', 'Hardware Security Module (HSM)', 'GPS / GLONASS Receiver'],
    samplePayload: {
      device_id: 'TCU-COMM-9842',
      hardware_rev: 'v3.2',
      bus_status: 'CAN_OK',
      buffer_depth_records: 14,
      gps_fix: '3D_DIFFERENTIAL',
      edge_filtered_dtcs: ['SPN 3251 FMI 0 (DPF High Pressure)']
    }
  },
  {
    id: 'cellular',
    label: 'Cellular Network',
    layer: 'network',
    layerName: 'Transport Layer',
    icon: Radio,
    protocol: '4G LTE-M / NB-IoT / 5G / Satellite Fallback',
    latency: '35 - 120 ms',
    throughput: '150 Mbps downlink / 50 Mbps uplink',
    description: 'Cellular carrier infrastructure routing encrypted telematics packets from commercial haulers across highways, depots, and cross-border corridors.',
    telematicsRole: 'Reliable telemetry transmission over cellular APNs, automatic roaming handoff between telecom towers, and satellite fallback in remote terrain.',
    hardwareOrTech: ['Multi-carrier eSIM (eUICC)', 'Quectel / Sierra Wireless Modem', 'IPSec Tunnel / mTLS', 'Band 28/40/3 LTE'],
    samplePayload: {
      network_type: 'LTE-M (Category M1)',
      operator: 'Global IoT Roaming Network',
      signal_rssi_dbm: -74,
      apn: 'telematics.fleet.secure',
      encryption: 'TLS 1.3 AES-256-GCM'
    }
  },
  {
    id: 'mqtt_broker',
    label: 'MQTT Broker (Cloud)',
    layer: 'cloud',
    layerName: 'Cloud Layer',
    icon: Server,
    protocol: 'MQTT v5.0 over TLS (Port 8883) / WebSockets',
    latency: '15 - 30 ms',
    throughput: '1,000,000+ msgs/sec clustering',
    description: 'Ultra-low latency pub/sub message broker terminating millions of concurrent persistent vehicular telemetry connections.',
    telematicsRole: 'Ingests real-time telemetry streams, applies QoS Level 1 (at least once delivery), decouples edge haulers from downstream analytical consumers.',
    hardwareOrTech: ['EMQX / Mosquitto Cluster', 'Kafka Ingestion Pipeline', 'K8s Auto-scaling Pods', 'Geo-distributed Broker Nodes'],
    samplePayload: {
      topic: 'fleet/vehicles/TRK-092/telemetry',
      qos: 1,
      retain: false,
      timestamp_utc: '2026-09-17T06:23:00.000Z',
      payload_bytes: 412
    }
  },
  {
    id: 'timeseries_db',
    label: 'Time-Series DB (Cloud)',
    layer: 'cloud',
    layerName: 'Cloud Layer',
    icon: Database,
    protocol: 'PostgreSQL / Redis / TimescaleDB Engine',
    latency: '< 10 ms query read / write',
    throughput: 'Write-optimized columnar storage',
    description: 'High-throughput database engine partitioned by vehicle VIN and timestamp for real-time live monitoring and 90-day predictive wear analysis.',
    telematicsRole: 'Performs windowed aggregations (hourly fuel burn, coolant thermal cycles, speed distributions) and guarantees data persistence across sessions.',
    hardwareOrTech: ['Redis / PostgreSQL', 'Timescale Hypertable Compression', 'Automated Cold Storage Archival', 'Continuous Materialized Views'],
    samplePayload: {
      record_id: 'rec_98319f0a',
      vehicle_id: 'TRK-092',
      metrics: {
        engine_rpm: 1420,
        oil_pressure_psi: 42.5,
        coolant_temp_c: 89.2,
        dpf_differential_psi: 1.4,
        speed_kmh: 78.4,
        tire_psi_avg: 104.2
      }
    }
  },
  {
    id: 'ai_engine',
    label: 'AI Engine (Cloud)',
    layer: 'cloud',
    layerName: 'Cloud Layer',
    icon: Sparkles,
    protocol: 'Gemini 3.8 Flash / Automotive Expert Rule Engine',
    latency: '350 - 650 ms',
    throughput: 'Parallel multi-fleet inference',
    description: 'Cloud intelligence system combining deep multimodal LLM diagnostics with commercial truck SAE J1939 knowledge graphs to generate actionable mechanic work orders.',
    telematicsRole: 'Translates raw DTC codes and sensor anomalies into plain-English root causes, estimates repair costs, and predicts component end-of-life.',
    hardwareOrTech: ['Gemini 3.8 Flash Server-Side API', 'SAE J1939 Fault Code Knowledge Base', 'Predictive Failure Models', 'Real-time Anomaly Detection'],
    samplePayload: {
      model: 'gemini-3.8-flash',
      diagnostic_status: 'CRITICAL',
      detected_faults: ['DPF Regeneration Failure', 'Soot Accumulation Rate High'],
      recommended_action: 'Perform forced stationary DPF regeneration; check differential pressure sensor delta',
      urgency: 'IMMEDIATE_ACTION_REQUIRED'
    }
  },
  {
    id: 'web_dashboard',
    label: 'Web Dashboard (App)',
    layer: 'app',
    layerName: 'App Layer',
    icon: Monitor,
    protocol: 'HTTPS / WebSockets / React 18 SPA',
    latency: '< 16 ms frame render (60 FPS)',
    throughput: 'Client-side sub-second updates',
    description: 'The operator, dispatcher, and technician user interface presenting real-time gauge clusters, interactive corridor maps, and repair dispatch workflows.',
    telematicsRole: 'Renders streaming vehicle gauges, live Google Maps fleet position feeds, interactive maintenance work orders, and instant technician copilot advice.',
    hardwareOrTech: ['FleetDiag AI Web Application', 'Google Maps Javascript Platform', 'SVG Precision Telemetry Gauges', 'Tailwind CSS Reactive Interface'],
    samplePayload: {
      app_version: '2.4.0',
      active_units_rendered: 4,
      connected_users: ['Mechanic Station #2', 'Fleet Dispatcher'],
      viewport_status: 'REALTIME_STREAMING'
    }
  }
];

interface TelematicsArchitectureProps {
  onBack?: () => void;
  className?: string;
  isStandalonePage?: boolean;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
}

export const TelematicsArchitecture: React.FC<TelematicsArchitectureProps> = ({
  onBack,
  className = '',
  isStandalonePage = false,
  isSimulating,
  onToggleSimulation,
}) => {
  const [activeHighlight, setActiveHighlight] = useState<ArchitectureLayer>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('gateway');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [internalSimPackets, setInternalSimPackets] = useState(true);
  const [packetStep, setPacketStep] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const isSimulatingPackets = isSimulating !== undefined ? isSimulating : internalSimPackets;
  const togglePacketSim = onToggleSimulation || (() => setInternalSimPackets(!internalSimPackets));

  // Animated packet transmission down the pipeline
  useEffect(() => {
    if (!isSimulatingPackets) return;
    const interval = setInterval(() => {
      setPacketStep((prev) => (prev + 1) % ARCHITECTURE_NODES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [isSimulatingPackets]);

  const selectedNode = ARCHITECTURE_NODES.find((n) => n.id === selectedNodeId) || ARCHITECTURE_NODES[0];

  const handleToggleHighlight = (layer: ArchitectureLayer) => {
    setActiveHighlight((prev) => (prev === layer ? 'all' : layer));
  };

  const isNodeHighlighted = (node: ArchitectureNode) => {
    if (activeHighlight === 'all') return true;
    return node.layer === activeHighlight;
  };

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'edge':
        return {
          border: 'border-emerald-500/60',
          bg: 'bg-emerald-950/40',
          text: 'text-emerald-300',
          glow: 'shadow-[0_0_18px_rgba(16,185,129,0.35)]',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
      case 'cloud':
        return {
          border: 'border-cyan-500/60',
          bg: 'bg-cyan-950/40',
          text: 'text-cyan-300',
          glow: 'shadow-[0_0_18px_rgba(6,182,212,0.35)]',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        };
      case 'app':
        return {
          border: 'border-amber-500/60',
          bg: 'bg-amber-950/40',
          text: 'text-amber-300',
          glow: 'shadow-[0_0_18px_rgba(245,158,11,0.35)]',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        };
      case 'network':
        return {
          border: 'border-violet-500/60',
          bg: 'bg-violet-950/40',
          text: 'text-violet-300',
          glow: 'shadow-[0_0_18px_rgba(139,92,246,0.35)]',
          badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40'
        };
      default:
        return {
          border: 'border-slate-700',
          bg: 'bg-slate-900',
          text: 'text-slate-100',
          glow: '',
          badge: 'bg-slate-800 text-slate-300 border-slate-700'
        };
    }
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedNode.samplePayload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'FleetDiag AI - Telematics System Architecture',
        text: 'Commercial heavy-duty telematics system architecture from Edge sensors to Cloud AI engine.',
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div
      className={`min-h-[85vh] bg-[#000000] text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 rounded-3xl border border-slate-900/80 shadow-2xl relative overflow-hidden ${className}`}
    >
      {/* Background Subtle Tech Grid Accent */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #38bdf8 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Header Row matching user's phone screenshot */}
      <div className="flex items-center justify-between pb-6 sm:pb-8 relative z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              title="Return to Dashboard"
              className="p-2 sm:p-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-normal tracking-tight text-white font-sans">
            Telematics System Architecture
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePacketSim}
            title={isSimulatingPackets ? 'Pause Telematics Stream' : 'Resume Telematics Stream'}
            className={`hidden sm:flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border transition-all ${
              isSimulatingPackets
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${isSimulatingPackets ? 'animate-pulse text-cyan-400' : ''}`} />
            <span>{isSimulatingPackets ? 'Live Stream Active' : 'Stream Inactive'}</span>
          </button>

          <button
            onClick={handleShare}
            title={copiedLink ? 'Link copied to clipboard!' : 'Share Architecture'}
            className="p-2 sm:p-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-800 relative"
          >
            {copiedLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content Layout: Vertical Architecture Flow + Interactive Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10 flex-1 my-2">
        {/* Left / Center Column: Exact Vertical Pipeline from Screenshot */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center w-full max-w-md mx-auto py-2">
          {ARCHITECTURE_NODES.map((node, index) => {
            const isHighlighted = isNodeHighlighted(node);
            const isSelected = selectedNodeId === node.id;
            const isCurrentPacket = isSimulatingPackets && packetStep === index;
            const colors = getLayerColor(node.layer);
            const NodeIcon = node.icon;

            return (
              <React.Fragment key={node.id}>
                {/* Node Box */}
                <div
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full max-w-sm sm:max-w-md transition-all duration-300 cursor-pointer select-none relative group ${
                    isHighlighted ? 'opacity-100' : 'opacity-30 blur-[0.5px]'
                  }`}
                >
                  <div
                    className={`relative rounded-xl-none px-5 py-3.5 sm:py-4 text-center border transition-all duration-200 ${
                      isSelected
                        ? `${colors.border} ${colors.bg} ${colors.glow} scale-[1.02] border-[1.5px]`
                        : isHighlighted
                        ? 'border-slate-600/90 bg-[#0c121e]/90 hover:border-slate-400'
                        : 'border-slate-800 bg-slate-950/80'
                    }`}
                  >
                    {/* Live Data Packet Badge on the left */}
                    {isCurrentPacket && (
                      <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-400 animate-ping" />
                    )}

                    <div className="flex items-center justify-center gap-2">
                      <NodeIcon
                        className={`w-4 h-4 shrink-0 ${
                          isSelected || isHighlighted ? colors.text : 'text-slate-400'
                        }`}
                      />
                      <span className="text-sm sm:text-base font-normal tracking-wide text-white font-sans">
                        {node.label}
                      </span>
                    </div>

                    {/* Small layer badge indicator visible on hover or selection */}
                    <div
                      className={`text-[10px] font-mono mt-1 transition-opacity ${
                        isSelected ? 'opacity-100 text-slate-300' : 'opacity-0 group-hover:opacity-80 text-slate-400'
                      }`}
                    >
                      {(node.protocol || '').split('(')[0].trim()} • {node.latency}
                    </div>
                  </div>
                </div>

                {/* Connecting Directional Arrow between Nodes (Except after last item) */}
                {index < ARCHITECTURE_NODES.length - 1 && (
                  <div className="my-1.5 sm:my-2 flex flex-col items-center justify-center relative">
                    {/* Pulsing telemetry dot along connector */}
                    {isSimulatingPackets && packetStep === index && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute animate-bounce" />
                    )}
                    <svg
                      width="16"
                      height="26"
                      viewBox="0 0 16 26"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={`transition-colors duration-200 ${
                        isHighlighted && isNodeHighlighted(ARCHITECTURE_NODES[index + 1])
                          ? 'text-slate-300'
                          : 'text-slate-700'
                      }`}
                    >
                      <line x1="8" y1="0" x2="8" y2="20" stroke="currentColor" strokeWidth="1.5" />
                      <polyline points="3,15 8,22 13,15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Right Column: Node Inspector & Real-Time Specifications */}
        <div className="lg:col-span-6 w-full space-y-4 bg-slate-950/80 border border-slate-800/80 rounded-3xl p-5 sm:p-6 backdrop-blur-md">
          {/* Header of Inspector */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-3xl flex items-center justify-center border ${
                  getLayerColor(selectedNode.layer).badge
                }`}
              >
                {React.createElement(selectedNode.icon, { className: 'w-5 h-5' })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white font-sans">
                    {selectedNode.label}
                  </h3>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border font-bold ${
                      getLayerColor(selectedNode.layer).badge
                    }`}
                  >
                    {selectedNode.layerName}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Protocol: <strong className="text-slate-200">{selectedNode.protocol}</strong>
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Est. Latency</span>
              <span className="text-xs font-mono font-bold text-cyan-400">{selectedNode.latency}</span>
            </div>
          </div>

          {/* Description & Telematics Role */}
          <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>{selectedNode.description}</p>
            <div className="bg-slate-900/90 rounded-3xl p-3 border border-slate-800 text-xs font-sans text-slate-300">
              <strong className="text-amber-400 font-mono block mb-1 uppercase tracking-wider text-[10px]">
                Telematics Role in FleetDiag AI
              </strong>
              {selectedNode.telematicsRole}
            </div>
          </div>

          {/* Key Technologies & Hardware */}
          <div>
            <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400 font-semibold block mb-2">
              Key Standards & Modules
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedNode.hardwareOrTech.map((tech, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 font-mono"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Live Sample Telemetry Payload */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Live Data Packet Frame
              </span>
              <button
                onClick={handleCopyPayload}
                className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                {copiedPayload ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-[#05080f] p-3.5 rounded-3xl border border-slate-800/80 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-44 scrollbar-thin">
              {JSON.stringify(selectedNode.samplePayload, null, 2)}
            </pre>
          </div>

          {/* Quick Info Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400 font-mono">
            <span>Throughput: {selectedNode.throughput}</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Node Healthy
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Layer Highlight Buttons matching user's phone screenshot */}
      <div className="w-full max-w-md mx-auto pt-6 sm:pt-8 space-y-2.5 relative z-10">
        {/* Row 1: Highlight Edge Layer | Highlight Cloud Layer */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleToggleHighlight('edge')}
            className={`py-3 sm:py-3.5 px-4 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all border ${
              activeHighlight === 'edge'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                : 'bg-[#181e29] hover:bg-[#202837] text-white border-transparent'
            }`}
          >
            Highlight Edge Layer
          </button>

          <button
            onClick={() => handleToggleHighlight('cloud')}
            className={`py-3 sm:py-3.5 px-4 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all border ${
              activeHighlight === 'cloud'
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                : 'bg-[#181e29] hover:bg-[#202837] text-white border-transparent'
            }`}
          >
            Highlight Cloud Layer
          </button>
        </div>

        {/* Row 2: Highlight App Layer (Full Width as in screenshot) */}
        <button
          onClick={() => handleToggleHighlight('app')}
          className={`w-full py-3 sm:py-3.5 px-4 rounded-full text-xs sm:text-sm font-medium tracking-wide transition-all border ${
            activeHighlight === 'app'
              ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#181e29] hover:bg-[#202837] text-white border-transparent'
          }`}
        >
          Highlight App Layer
        </button>

        {/* Optional Reset / Show All Trigger if a layer is currently isolated */}
        {activeHighlight !== 'all' && (
          <div className="text-center pt-1">
            <button
              onClick={() => setActiveHighlight('all')}
              className="text-xs font-mono text-slate-400 hover:text-white underline underline-offset-4 transition-colors"
            >
              Reset Highlights (Show All Layers)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
