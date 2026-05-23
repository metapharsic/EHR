"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Stethoscope,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle,
  Video,
  Building2,
  Clock3,
  CalendarDays,
  List,
  Grid3X3,
  Sparkles,
  Brain,
  Zap,
  Bell,
  MessageSquare,
  Printer,
  Share2,
  Download,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Types
interface Appointment {
  id: string;
  patientName: string;
  patientId: string;
  age: number;
  gender: string;
  time: string;
  duration: number;
  type: "consultation" | "follow-up" | "procedure" | "telehealth" | "urgent";
  status: "scheduled" | "checked-in" | "in-progress" | "completed" | "cancelled" | "no-show";
  provider: string;
  providerId: string;
  department: string;
  room: string;
  chiefComplaint: string;
  notes?: string;
  insurance: string;
  phone: string;
  email: string;
  isNewPatient: boolean;
  isRecurring: boolean;
  lastVisit?: string;
  nextAppointment?: string;
  vitals?: {
    bp?: string;
    hr?: number;
    temp?: number;
    weight?: number;
  };
}

interface TimeSlot {
  time: string;
  available: boolean;
  appointments: Appointment[];
}

interface Provider {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  schedule: {
    start: string;
    end: string;
    breakStart?: string;
    breakEnd?: string;
  };
  color: string;
}

// Mock Data
const providers: Provider[] = [
  { id: "1", name: "Dr. Sarah Chen", role: "Cardiologist", department: "Cardiology", avatar: "SC", schedule: { start: "09:00", end: "17:00", breakStart: "12:00", breakEnd: "13:00" }, color: "bg-cyan-500" },
  { id: "2", name: "Dr. Michael Ross", role: "Primary Care", department: "Internal Medicine", avatar: "MR", schedule: { start: "08:00", end: "16:00" }, color: "bg-violet-500" },
  { id: "3", name: "Dr. Emily Watson", role: "Pediatrician", department: "Pediatrics", avatar: "EW", schedule: { start: "09:00", end: "17:00", breakStart: "12:30", breakEnd: "13:30" }, color: "bg-emerald-500" },
  { id: "4", name: "Dr. James Wilson", role: "Orthopedic Surgeon", department: "Orthopedics", avatar: "JW", schedule: { start: "08:30", end: "16:30" }, color: "bg-amber-500" },
  { id: "5", name: "Dr. Lisa Park", role: "Dermatologist", department: "Dermatology", avatar: "LP", schedule: { start: "10:00", end: "18:00" }, color: "bg-rose-500" },
];

const appointments: Appointment[] = [
  {
    id: "APT001",
    patientName: "John Smith",
    patientId: "PT12345",
    age: 45,
    gender: "Male",
    time: "09:00",
    duration: 30,
    type: "follow-up",
    status: "checked-in",
    provider: "Dr. Sarah Chen",
    providerId: "1",
    department: "Cardiology",
    room: "Room 201",
    chiefComplaint: "Hypertension follow-up, medication review",
    insurance: "Blue Cross Blue Shield",
    phone: "(555) 123-4567",
    email: "john.smith@email.com",
    isNewPatient: false,
    isRecurring: true,
    lastVisit: "2024-01-15",
    vitals: { bp: "138/88", hr: 72, temp: 98.6, weight: 185 },
  },
  {
    id: "APT002",
    patientName: "Maria Garcia",
    patientId: "PT12346",
    age: 32,
    gender: "Female",
    time: "09:30",
    duration: 45,
    type: "consultation",
    status: "in-progress",
    provider: "Dr. Michael Ross",
    providerId: "2",
    department: "Internal Medicine",
    room: "Room 105",
    chiefComplaint: "Chest pain, shortness of breath",
    insurance: "Aetna",
    phone: "(555) 234-5678",
    email: "maria.garcia@email.com",
    isNewPatient: true,
    isRecurring: false,
  },
  {
    id: "APT003",
    patientName: "Robert Johnson",
    patientId: "PT12347",
    age: 58,
    gender: "Male",
    time: "10:00",
    duration: 60,
    type: "procedure",
    status: "scheduled",
    provider: "Dr. James Wilson",
    providerId: "4",
    department: "Orthopedics",
    room: "Procedure Room 3",
    chiefComplaint: "Knee arthroscopy - pre-op consultation",
    insurance: "Medicare",
    phone: "(555) 345-6789",
    email: "robert.j@email.com",
    isNewPatient: false,
    isRecurring: false,
  },
  {
    id: "APT004",
    patientName: "Emma Thompson",
    patientId: "PT12348",
    age: 28,
    gender: "Female",
    time: "10:30",
    duration: 30,
    type: "telehealth",
    status: "scheduled",
    provider: "Dr. Lisa Park",
    providerId: "5",
    department: "Dermatology",
    room: "Virtual",
    chiefComplaint: "Skin rash evaluation",
    insurance: "United Healthcare",
    phone: "(555) 456-7890",
    email: "emma.t@email.com",
    isNewPatient: false,
    isRecurring: false,
  },
  {
    id: "APT005",
    patientName: "David Lee",
    patientId: "PT12349",
    age: 6,
    gender: "Male",
    time: "11:00",
    duration: 30,
    type: "consultation",
    status: "scheduled",
    provider: "Dr. Emily Watson",
    providerId: "3",
    department: "Pediatrics",
    room: "Room 302",
    chiefComplaint: "Annual wellness check, vaccinations",
    insurance: "Kaiser Permanente",
    phone: "(555) 567-8901",
    email: "david.lee.parent@email.com",
    isNewPatient: false,
    isRecurring: true,
    lastVisit: "2023-08-20",
  },
  {
    id: "APT006",
    patientName: "Sarah Williams",
    patientId: "PT12350",
    age: 52,
    gender: "Female",
    time: "11:30",
    duration: 30,
    type: "urgent",
    status: "checked-in",
    provider: "Dr. Michael Ross",
    providerId: "2",
    department: "Internal Medicine",
    room: "Room 106",
    chiefComplaint: "Severe abdominal pain",
    insurance: "Cigna",
    phone: "(555) 678-9012",
    email: "sarah.w@email.com",
    isNewPatient: false,
    isRecurring: false,
  },
  {
    id: "APT007",
    patientName: "Michael Brown",
    patientId: "PT12351",
    age: 67,
    gender: "Male",
    time: "14:00",
    duration: 45,
    type: "follow-up",
    status: "scheduled",
    provider: "Dr. Sarah Chen",
    providerId: "1",
    department: "Cardiology",
    room: "Room 202",
    chiefComplaint: "Post-MI follow-up, medication adjustment",
    insurance: "Medicare Advantage",
    phone: "(555) 789-0123",
    email: "michael.b@email.com",
    isNewPatient: false,
    isRecurring: true,
    lastVisit: "2024-01-01",
    vitals: { bp: "142/90", hr: 68, temp: 98.4, weight: 195 },
  },
];

// Components
function StatusBadge({ status }: { status: Appointment["status"] }) {
  const styles = {
    scheduled: "bg-slate-100 text-slate-600 border-slate-200",
    "checked-in": "bg-blue-50 text-blue-600 border-blue-200",
    "in-progress": "bg-amber-50 text-amber-600 border-amber-200",
    completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
    cancelled: "bg-rose-50 text-rose-600 border-rose-200",
    "no-show": "bg-slate-100 text-slate-500 border-slate-200",
  };

  const icons = {
    scheduled: Clock,
    "checked-in": CheckCircle,
    "in-progress": AlertCircle,
    completed: CheckCircle,
    cancelled: XCircle,
    "no-show": AlertCircle,
  };

  const Icon = icons[status];

  return (
    <Badge variant="outline" className={cn("capitalize", styles[status])}>
      <Icon className="w-3 h-3 mr-1" />
      {status.replace("-", " ")}
    </Badge>
  );
}

function TypeBadge({ type }: { type: Appointment["type"] }) {
  const styles = {
    consultation: "bg-cyan-50 text-cyan-600",
    "follow-up": "bg-violet-50 text-violet-600",
    procedure: "bg-amber-50 text-amber-600",
    telehealth: "bg-emerald-50 text-emerald-600",
    urgent: "bg-rose-50 text-rose-600",
  };

  const icons = {
    consultation: Stethoscope,
    "follow-up": Calendar,
    procedure: Building2,
    telehealth: Video,
    urgent: AlertCircle,
  };

  const Icon = icons[type];

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", styles[type])}>
      <Icon className="w-3 h-3" />
      {type.replace("-", " ")}
    </span>
  );
}

function AppointmentCard({ appointment, onClick, onStatusChange }: { appointment: Appointment; onClick: () => void; onStatusChange: (id: string, status: Appointment["status"]) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {appointment.patientName.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-cyan-600 transition-colors">
              {appointment.patientName}
              {appointment.isNewPatient && (
                <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-[10px]">New</Badge>
              )}
            </h3>
            <p className="text-sm text-slate-500">
              {appointment.age}y • {appointment.gender} • {appointment.patientId}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">{appointment.time}</p>
          <p className="text-xs text-slate-500">{appointment.duration} min</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <StatusBadge status={appointment.status} />
        <TypeBadge type={appointment.type} />
        {appointment.isRecurring && (
          <Badge variant="outline" className="text-[10px]">
            <CalendarDays className="w-3 h-3 mr-1" />
            Recurring
          </Badge>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Stethoscope className="w-4 h-4 text-slate-400" />
          <span className="truncate">{appointment.chiefComplaint}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <User className="w-4 h-4 text-slate-400" />
          <span>{appointment.provider}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">{appointment.department}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>{appointment.room}</span>
        </div>
      </div>

      {appointment.vitals && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-4 text-xs">
            {appointment.vitals.bp && (
              <span className="flex items-center gap-1 text-slate-600">
                <span className="font-medium">BP:</span> {appointment.vitals.bp}
              </span>
            )}
            {appointment.vitals.hr && (
              <span className="flex items-center gap-1 text-slate-600">
                <span className="font-medium">HR:</span> {appointment.vitals.hr}
              </span>
            )}
            {appointment.vitals.temp && (
              <span className="flex items-center gap-1 text-slate-600">
                <span className="font-medium">Temp:</span> {appointment.vitals.temp}°F
              </span>
            )}
          </div>
        </div>
      )}
      <StatusActions appointment={appointment} onStatusChange={onStatusChange} />
    </motion.div>
  );
}

function TimelineView({ appointments, onSelect }: { appointments: Appointment[]; onSelect: (apt: Appointment) => void }) {
  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30",
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-[100px_1fr] divide-x divide-slate-200">
        {/* Time Column */}
        <div className="bg-slate-50">
          {timeSlots.map((time) => (
            <div key={time} className="h-20 border-b border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
              {time}
            </div>
          ))}
        </div>

        {/* Appointments Column */}
        <div className="relative">
          {timeSlots.map((time) => (
            <div key={time} className="h-20 border-b border-slate-100" />
          ))}

          {appointments.map((apt) => {
            const hour = parseInt(apt.time.split(":")[0]);
            const minute = parseInt(apt.time.split(":")[1]);
            const top = ((hour - 8) * 2 + (minute / 30)) * 80;
            const height = (apt.duration / 30) * 80;

            return (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => onSelect(apt)}
                style={{ top: `${top}px`, height: `${height - 4}px` }}
                className={cn(
                  "absolute left-2 right-2 rounded-lg p-2 cursor-pointer hover:shadow-md transition-all overflow-hidden",
                  apt.status === "in-progress" ? "bg-amber-50 border border-amber-200" :
                  apt.status === "completed" ? "bg-emerald-50 border border-emerald-200" :
                  apt.status === "checked-in" ? "bg-blue-50 border border-blue-200" :
                  apt.type === "urgent" ? "bg-rose-50 border border-rose-200" :
                  "bg-cyan-50 border border-cyan-200"
                )}
              >
                <p className="font-semibold text-sm text-slate-900 truncate">{apt.patientName}</p>
                <p className="text-xs text-slate-600 truncate">{apt.chiefComplaint}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 text-slate-600">
                    {apt.duration}m
                  </span>
                  {apt.room !== "Virtual" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 text-slate-600">
                      {apt.room}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AppointmentModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  if (!appointment) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
              {appointment.patientName.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{appointment.patientName}</h2>
              <p className="text-slate-500">{appointment.patientId} • {appointment.age} years • {appointment.gender}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={appointment.status} />
                <TypeBadge type={appointment.type} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <XCircle className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Appointment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Date & Time</p>
              <p className="font-semibold text-slate-900">{appointment.time}</p>
              <p className="text-sm text-slate-600">{appointment.duration} minutes</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Provider</p>
              <p className="font-semibold text-slate-900">{appointment.provider}</p>
              <p className="text-sm text-slate-600">{appointment.department}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Location</p>
              <p className="font-semibold text-slate-900">{appointment.room}</p>
              <p className="text-sm text-slate-600">Main Campus</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-1">Insurance</p>
              <p className="font-semibold text-slate-900">{appointment.insurance}</p>
              <p className="text-sm text-slate-600">Verified</p>
            </div>
          </div>

          {/* Chief Complaint */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-cyan-500" />
              Chief Complaint
            </h3>
            <p className="p-4 bg-slate-50 rounded-xl text-slate-700">{appointment.chiefComplaint}</p>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-500" />
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">{appointment.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{appointment.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vitals */}
          {appointment.vitals && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-500" />
                Pre-Visit Vitals
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {appointment.vitals.bp && (
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-blue-600">{appointment.vitals.bp}</p>
                    <p className="text-xs text-slate-600">Blood Pressure</p>
                  </div>
                )}
                {appointment.vitals.hr && (
                  <div className="p-3 bg-emerald-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-emerald-600">{appointment.vitals.hr}</p>
                    <p className="text-xs text-slate-600">Heart Rate</p>
                  </div>
                )}
                {appointment.vitals.temp && (
                  <div className="p-3 bg-amber-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-amber-600">{appointment.vitals.temp}°F</p>
                    <p className="text-xs text-slate-600">Temperature</p>
                  </div>
                )}
                {appointment.vitals.weight && (
                  <div className="p-3 bg-violet-50 rounded-xl text-center">
                    <p className="text-2xl font-bold text-violet-600">{appointment.vitals.weight}</p>
                    <p className="text-xs text-slate-600">Weight (lbs)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visit History */}
          {appointment.lastVisit && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Previous Visit</h3>
              <p className="text-sm text-slate-600">Last seen on {appointment.lastVisit}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Message
            </Button>
            <Button variant="outline" className="gap-2">
              <Bell className="w-4 h-4" />
              Remind
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button className="gap-2 bg-cyan-500 hover:bg-cyan-600">
              <FileText className="w-4 h-4" />
              Start Encounter
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Import Activity icon
import { Activity, UserCheck, UserX, PlayCircle, StopCircle, DoorOpen } from "lucide-react";

// Check-in/out status flow actions
function StatusActions({ appointment, onStatusChange }: { appointment: Appointment; onStatusChange: (id: string, status: Appointment["status"]) => void }) {
  const actions: { label: string; nextStatus: Appointment["status"]; color: string; icon: any }[] = [];

  if (appointment.status === "scheduled") {
    actions.push({ label: "Check In", nextStatus: "checked-in", color: "bg-blue-500 hover:bg-blue-600 text-white", icon: UserCheck });
    actions.push({ label: "No Show", nextStatus: "no-show", color: "border border-slate-300 text-slate-600 hover:bg-slate-50", icon: UserX });
    actions.push({ label: "Cancel", nextStatus: "cancelled", color: "border border-rose-300 text-rose-600 hover:bg-rose-50", icon: XCircle });
  } else if (appointment.status === "checked-in") {
    actions.push({ label: "Start Encounter", nextStatus: "in-progress", color: "bg-amber-500 hover:bg-amber-600 text-white", icon: PlayCircle });
  } else if (appointment.status === "in-progress") {
    actions.push({ label: "Complete", nextStatus: "completed", color: "bg-emerald-500 hover:bg-emerald-600 text-white", icon: CheckCircle });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-slate-100">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, action.nextStatus); }}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all", action.color)}
        >
          <action.icon className="w-3.5 h-3.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
}

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [aptList, setAptList] = useState<Appointment[]>(appointments);

  const handleStatusChange = (id: string, status: Appointment["status"]) => {
    setAptList((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    if (selectedAppointment?.id === id) setSelectedAppointment((prev) => prev ? { ...prev, status } : null);
  };

  const filteredAppointments = aptList.filter((apt) => {
    const matchesProvider = selectedProvider === "all" || apt.providerId === selectedProvider;
    const matchesStatus = selectedStatus === "all" || apt.status === selectedStatus;
    const matchesSearch = apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         apt.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProvider && matchesStatus && matchesSearch;
  });

  const stats = {
    total: aptList.length,
    checkedIn: aptList.filter((a) => a.status === "checked-in").length,
    inProgress: aptList.filter((a) => a.status === "in-progress").length,
    completed: aptList.filter((a) => a.status === "completed").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-cyan-500" />
            Schedule & Appointments
          </h1>
          <p className="text-slate-500">Manage patient appointments and provider schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button className="gap-2 bg-cyan-500 hover:bg-cyan-600">
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* AI Schedule Assistant */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl p-4 border border-cyan-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              Metta AI Schedule Assistant
              <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
            </h3>
            <p className="text-sm text-slate-600">
              AI has optimized today's schedule. 3 slots available for urgent cases. Predicted no-show rate: 8%.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Brain className="w-4 h-4" />
              Optimize
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Zap className="w-4 h-4" />
              Auto-Fill
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Total Today</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Checked In</p>
          <p className="text-2xl font-bold text-blue-600">{stats.checkedIn}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">In Progress</p>
          <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients, complaints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>

          {/* Provider Filter */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="checked-in">Checked In</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              viewMode === "timeline" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Clock3 className="w-4 h-4" />
            Timeline
          </button>
        </div>
      </div>

      {/* Provider Legend */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <span className="text-sm text-slate-500 whitespace-nowrap">Providers:</span>
        {providers.map((provider) => (
          <div key={provider.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 whitespace-nowrap">
            <div className={cn("w-3 h-3 rounded-full", provider.color)} />
            <span className="text-sm font-medium text-slate-700">{provider.name}</span>
            <span className="text-xs text-slate-400">{provider.schedule.start}-{provider.schedule.end}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <div className="grid gap-4">
          {filteredAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onClick={() => setSelectedAppointment(appointment)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <TimelineView
          appointments={filteredAppointments}
          onSelect={setSelectedAppointment}
        />
      )}

      {/* Empty State */}
      {filteredAppointments.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No appointments found</h3>
          <p className="text-slate-500">Try adjusting your filters or search query</p>
        </div>
      )}

      {/* Modal */}
      {selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </div>
  );
}
