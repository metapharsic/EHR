"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { 
  User, Stethoscope, FileText, ClipboardList, 
  ChevronRight, ChevronDown, MapPin, Phone, 
  Calendar, CreditCard, AlertCircle, CheckCircle2,
  ArrowRight, ArrowDown, GitBranch
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowNode {
  id: string;
  type: "START" | "DEMOGRAPHICS" | "MEDICAL_HISTORY" | "SYMPTOMS" | "DIAGNOSIS" | "PLAN" | "REPORT" | "END";
  label: string;
  description?: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  extractedData?: Record<string, any>;
  nextNodes?: string[];
  rephraseOptions?: string[];
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

interface ConversationFlowDiagramProps {
  currentNodeId?: string;
  completedNodes?: string[];
  onNodeClick?: (node: FlowNode) => void;
  onRephraseRequest?: (node: FlowNode) => void;
}

const NODE_CONFIG: Record<FlowNode["type"], { 
  icon: any; 
  color: string; 
  bgColor: string;
  borderColor: string;
}> = {
  START: { 
    icon: Stethoscope, 
    color: "text-cyan-400", 
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30"
  },
  DEMOGRAPHICS: { 
    icon: User, 
    color: "text-blue-400", 
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30"
  },
  MEDICAL_HISTORY: { 
    icon: ClipboardList, 
    color: "text-purple-400", 
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30"
  },
  SYMPTOMS: { 
    icon: AlertCircle, 
    color: "text-amber-400", 
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30"
  },
  DIAGNOSIS: { 
    icon: CheckCircle2, 
    color: "text-emerald-400", 
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30"
  },
  PLAN: { 
    icon: FileText, 
    color: "text-rose-400", 
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30"
  },
  REPORT: { 
    icon: FileText, 
    color: "text-indigo-400", 
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/30"
  },
  END: { 
    icon: CheckCircle2, 
    color: "text-slate-400", 
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30"
  },
};

// Default conversation flow
const DEFAULT_FLOW: FlowNode[] = [
  {
    id: "start",
    type: "START",
    label: "Start Encounter",
    description: "Begin patient interaction",
    status: "COMPLETED",
    nextNodes: ["demographics"],
  },
  {
    id: "demographics",
    type: "DEMOGRAPHICS",
    label: "Demographics",
    description: "Collect patient information",
    status: "ACTIVE",
    nextNodes: ["medical_history"],
    rephraseOptions: [
      "Could you please confirm your full name?",
      "What is your date of birth?",
      "May I have your contact information?",
    ],
  },
  {
    id: "medical_history",
    type: "MEDICAL_HISTORY",
    label: "Medical History",
    description: "Past conditions & medications",
    status: "PENDING",
    nextNodes: ["symptoms"],
    rephraseOptions: [
      "Do you have any chronic conditions?",
      "What medications are you currently taking?",
      "Any allergies I should know about?",
    ],
  },
  {
    id: "symptoms",
    type: "SYMPTOMS",
    label: "Chief Complaint",
    description: "Current symptoms & concerns",
    status: "PENDING",
    nextNodes: ["diagnosis"],
    rephraseOptions: [
      "What brings you in today?",
      "Can you describe your symptoms?",
      "When did this start?",
    ],
  },
  {
    id: "diagnosis",
    type: "DIAGNOSIS",
    label: "Assessment",
    description: "Clinical findings & diagnosis",
    status: "PENDING",
    nextNodes: ["plan"],
    rephraseOptions: [
      "Based on your symptoms...",
      "The examination shows...",
      "Your diagnosis is...",
    ],
  },
  {
    id: "plan",
    type: "PLAN",
    label: "Treatment Plan",
    description: "Recommendations & follow-up",
    status: "PENDING",
    nextNodes: ["report"],
    rephraseOptions: [
      "I recommend the following treatment...",
      "Here's what we need to do...",
      "Your follow-up plan is...",
    ],
  },
  {
    id: "report",
    type: "REPORT",
    label: "Reports & Orders",
    description: "Lab orders & documentation",
    status: "PENDING",
    nextNodes: ["end"],
    rephraseOptions: [
      "I'll order these tests...",
      "Let me generate your report...",
      "Here are your prescriptions...",
    ],
  },
  {
    id: "end",
    type: "END",
    label: "Complete",
    description: "Encounter documentation complete",
    status: "PENDING",
  },
];

export function ConversationFlowDiagram({
  currentNodeId = "demographics",
  completedNodes = ["start"],
  onNodeClick,
  onRephraseRequest,
}: ConversationFlowDiagramProps) {
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_FLOW);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  // Update node statuses based on props
  useEffect(() => {
    setNodes(prev => prev.map(node => ({
      ...node,
      status: completedNodes.includes(node.id) 
        ? "COMPLETED" 
        : node.id === currentNodeId 
          ? "ACTIVE" 
          : "PENDING",
    })));
  }, [currentNodeId, completedNodes]);

  return (
    <div className="w-full p-6 bg-slate-900/50 rounded-2xl border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Conversation Flow</h3>
          <p className="text-xs text-slate-400">Visual guide for patient encounter</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500" />
            <span className="text-slate-400">Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-cyan-500/30 border border-cyan-500 animate-pulse" />
            <span className="text-slate-400">Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-700 border border-slate-600" />
            <span className="text-slate-400">Pending</span>
          </div>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="relative">
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          {nodes.map((node, index) => {
            if (index >= nodes.length - 1) return null;
            const nextNode = nodes[index + 1];
            return (
              <line
                key={`line-${node.id}`}
                x1="24"
                y1={index * 100 + 40}
                x2="24"
                y2={(index + 1) * 100 + 10}
                stroke={node.status === "COMPLETED" ? "#10b981" : "#475569"}
                strokeWidth="2"
                strokeDasharray={node.status === "COMPLETED" ? "0" : "4 4"}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        <div className="relative space-y-6" style={{ zIndex: 1 }}>
          {nodes.map((node, index) => {
            const config = NODE_CONFIG[node.type];
            const Icon = config.icon;
            const isExpanded = expandedNode === node.id;

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                  config.bgColor,
                  config.borderColor,
                  node.status === "ACTIVE" && "ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20",
                  node.status === "COMPLETED" && "opacity-80"
                )}
                onClick={() => {
                  setExpandedNode(isExpanded ? null : node.id);
                  onNodeClick?.(node);
                }}
              >
                {/* Node Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  "bg-slate-900/50 border border-slate-700/50",
                  node.status === "ACTIVE" && "animate-pulse"
                )}>
                  <Icon className={cn("w-6 h-6", config.color)} />
                </div>

                {/* Node Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={cn("font-semibold", config.color)}>{node.label}</h4>
                      <p className="text-xs text-slate-400">{node.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {node.status === "COMPLETED" && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      )}
                      {node.status === "ACTIVE" && (
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                      <ChevronDown className={cn(
                        "w-4 h-4 text-slate-400 transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && node.rephraseOptions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 pt-3 border-t border-slate-700/50"
                    >
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        Suggested conversation paths:
                      </p>
                      <div className="space-y-2">
                        {node.rephraseOptions.map((option, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRephraseRequest?.(node);
                            }}
                            className="w-full text-left p-2 text-xs text-slate-300 
                                     bg-slate-800/50 hover:bg-cyan-500/10 
                                     border border-slate-700/50 hover:border-cyan-500/30
                                     rounded-lg transition-all flex items-center gap-2"
                          >
                            <ArrowRight className="w-3 h-3 text-cyan-400" />
                            {option}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Extracted Data Preview */}
                  {node.extractedData && Object.keys(node.extractedData).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(node.extractedData).map(([key, value]) => (
                        <span 
                          key={key}
                          className="px-2 py-1 text-[10px] bg-slate-800 text-slate-300 rounded-full"
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step Number */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full 
                                bg-slate-800 border border-slate-600 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-slate-400">{index + 1}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-500 mb-2">Click any node to see rephrasing options for that stage</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(NODE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <div key={type} className="flex items-center gap-1 text-[10px] text-slate-400">
                <Icon className={cn("w-3 h-3", config.color)} />
                <span>{type.replace("_", " ")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
