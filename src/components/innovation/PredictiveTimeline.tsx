"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Clock,
  ChevronRight,
  Sparkles,
  Target,
  Shield,
  Activity,
  Dna,
  Zap,
  Filter,
  Download,
  Share2,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  date: string;
  type: "prediction" | "milestone" | "risk" | "intervention" | "genetic";
  title: string;
  description: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  category: string;
  actionable: boolean;
}

interface HealthTrajectory {
  month: string;
  actual: number;
  predicted: number;
  optimistic: number;
  pessimistic: number;
  interventions: number;
}

const trajectoryData: HealthTrajectory[] = [
  { month: "Jan", actual: 82, predicted: 82, optimistic: 82, pessimistic: 82, interventions: 0 },
  { month: "Feb", actual: 83, predicted: 84, optimistic: 86, pessimistic: 81, interventions: 1 },
  { month: "Mar", actual: 85, predicted: 86, optimistic: 89, pessimistic: 83, interventions: 0 },
  { month: "Apr", actual: 84, predicted: 87, optimistic: 91, pessimistic: 84, interventions: 2 },
  { month: "May", actual: 86, predicted: 88, optimistic: 93, pessimistic: 85, interventions: 1 },
  { month: "Jun", actual: 88, predicted: 89, optimistic: 94, pessimistic: 86, interventions: 0 },
  { month: "Jul", actual: 89, predicted: 90, optimistic: 95, pessimistic: 87, interventions: 1 },
  { month: "Aug", actual: 90, predicted: 91, optimistic: 96, pessimistic: 88, interventions: 0 },
  { month: "Sep", actual: 91, predicted: 92, optimistic: 97, pessimistic: 89, interventions: 1 },
  { month: "Oct", actual: 92, predicted: 93, optimistic: 98, pessimistic: 90, interventions: 0 },
  { month: "Nov", actual: 93, predicted: 94, optimistic: 99, pessimistic: 91, interventions: 1 },
  { month: "Dec", actual: 94, predicted: 95, optimistic: 100, pessimistic: 92, interventions: 0 },
];

const timelineEvents: TimelineEvent[] = [
  {
    id: "1",
    date: "2024-07-15",
    type: "prediction",
    title: "Diabetes Risk Assessment",
    description: "AI predicts 23% risk of Type 2 diabetes within 5 years based on current trajectory",
    confidence: 89,
    impact: "high",
    category: "Metabolic",
    actionable: true,
  },
  {
    id: "2",
    date: "2024-08-01",
    type: "intervention",
    title: "Preventive Care Window",
    description: "Optimal intervention period for lifestyle modifications to reduce cardiovascular risk",
    confidence: 94,
    impact: "high",
    category: "Cardiovascular",
    actionable: true,
  },
  {
    id: "3",
    date: "2024-09-20",
    type: "genetic",
    title: "Pharmacogenomic Alert",
    description: "Genetic markers suggest higher efficacy for alternative statin therapy",
    confidence: 87,
    impact: "medium",
    category: "Genomics",
    actionable: true,
  },
  {
    id: "4",
    date: "2024-10-15",
    type: "milestone",
    title: "Health Goal Projection",
    description: "Projected achievement of target BMI with current intervention plan",
    confidence: 78,
    impact: "medium",
    category: "Wellness",
    actionable: false,
  },
  {
    id: "5",
    date: "2024-11-30",
    type: "risk",
    title: "Seasonal Risk Alert",
    description: "Historical data predicts increased respiratory vulnerability during flu season",
    confidence: 82,
    impact: "medium",
    category: "Immunology",
    actionable: true,
  },
];

const categoryColors: Record<string, string> = {
  Metabolic: "from-amber-500 to-orange-500",
  Cardiovascular: "from-rose-500 to-pink-500",
  Genomics: "from-purple-500 to-indigo-500",
  Wellness: "from-emerald-500 to-teal-500",
  Immunology: "from-cyan-500 to-blue-500",
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  prediction: Brain,
  milestone: Target,
  risk: AlertTriangle,
  intervention: Zap,
  genetic: Dna,
};

export function PredictiveTimeline() {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [timeRange, setTimeRange] = useState<"3m" | "6m" | "1y" | "5y">("1y");
  const [showConfidence, setShowConfidence] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredEvents = activeCategory
    ? timelineEvents.filter((e) => e.category === activeCategory)
    : timelineEvents;

  return (
    <Card className="glass-card border-0 overflow-hidden">
      <CardHeader className="border-b border-slate-100 ">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">AI-Powered Health Timeline</CardTitle>
              <p className="text-xs text-slate-500">Predictive analytics & future health forecasting</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Time Range Selector */}
            <div className="flex bg-slate-100  rounded-lg p-1">
              {(["3m", "6m", "1y", "5y"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    timeRange === range
                      ? "bg-white  text-slate-800  shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {range}
                </button>
              ))}
            </div>

            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Health Trajectory Chart */}
        <div className="h-[300px] mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPessimistic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={[70, 105]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                }}
              />
              
              {showConfidence && (
                <>
                  <Area
                    type="monotone"
                    dataKey="optimistic"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorOptimistic)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pessimistic"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorPessimistic)"
                  />
                </>
              )}
              
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="#06b6d4"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorPredicted)"
              />
              
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />

              <ReferenceLine x="Jun" stroke="#94a3b8" strokeDasharray="3 3" label="Today" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-slate-600">Actual Health Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-500" />
            <span className="text-slate-600">AI Predicted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-50" />
            <span className="text-slate-600">Optimistic Scenario</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 opacity-50" />
            <span className="text-slate-600">Pessimistic Scenario</span>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              activeCategory === null
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            All Events
          </button>
          {Object.entries(categoryColors).map(([category, gradient]) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                activeCategory === category
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full bg-gradient-to-r", gradient)} />
              {category}
            </button>
          ))}
        </div>

        {/* Timeline Events */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500" />

          <div className="space-y-4">
            {filteredEvents.map((event, index) => {
              const Icon = typeIcons[event.type];
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative flex gap-4 p-4 rounded-xl cursor-pointer transition-all",
                    "hover:bg-slate-50 ",
                    selectedEvent?.id === event.id && "bg-slate-50  ring-2 ring-cyan-500/20"
                  )}
                  onClick={() => setSelectedEvent(event)}
                >
                  {/* Timeline Node */}
                  <div className="relative z-10">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        "bg-gradient-to-br shadow-lg",
                        categoryColors[event.category]
                      )}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    {event.actionable && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-white " />
                    )}
                  </div>

                  {/* Event Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-800 ">
                            {event.title}
                          </h4>
                          <Badge
                            className={cn(
                              "text-[10px] border-0",
                              event.impact === "high" && "bg-rose-100 text-rose-700",
                              event.impact === "medium" && "bg-amber-100 text-amber-700",
                              event.impact === "low" && "bg-slate-100 text-slate-700"
                            )}
                          >
                            {event.impact} impact
                          </Badge>
                          {event.actionable && (
                            <Badge className="text-[10px] bg-cyan-100 text-cyan-700 border-0">
                              <Zap className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{event.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Brain className="h-3 w-3" />
                            {event.confidence}% confidence
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {event.category}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* AI Insights Footer */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-slate-800 ">
                AI Recommendation
              </h4>
              <p className="text-sm text-slate-600  mt-1">
                Based on predictive modeling, initiating lifestyle interventions in the next 30 days 
                could improve 5-year health outcomes by up to 15%. Focus areas: metabolic health 
                and cardiovascular fitness.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  <Target className="h-3 w-3 mr-1" />
                  Create Action Plan
                </Button>
                <Button size="sm" variant="outline">
                  <Share2 className="h-3 w-3 mr-1" />
                  Share with Patient
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
