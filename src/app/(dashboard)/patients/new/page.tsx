"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreatePatient } from "@/hooks/usePatients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  User,
  MapPin,
  Phone,
  Shield,
  FileCheck,
} from "lucide-react";

const steps = [
  { id: "demographics", title: "Demographics", icon: User },
  { id: "address", title: "Address & Contact", icon: MapPin },
  { id: "emergency", title: "Emergency Contact", icon: Phone },
  { id: "insurance", title: "Insurance", icon: Shield },
  { id: "review", title: "Review", icon: FileCheck },
];

export default function NewPatientPage() {
  const router = useRouter();
  const createPatient = useCreatePatient();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    // Demographics
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    gender: "",
    aadhaar: "",
    abhaId: "",
    maritalStatus: "",
    bloodGroup: "",
    motherTongue: "",
    preferredLanguage: "English",
    
    // Address
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    
    // Contact
    phone: "",
    email: "",
    
    // Emergency Contact
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    emergencyEmail: "",
    
    // Insurance
    insuranceProvider: "",
    policyNumber: "",
    groupNumber: "",
    subscriberName: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    setError("");
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setError("");
    
    try {
      const patientData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender as any,
        aadhaar: formData.aadhaar || undefined,
        abhaId: formData.abhaId || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        motherTongue: formData.motherTongue || undefined,
        preferredLanguage: formData.preferredLanguage,
        status: "ACTIVE" as const,
        addresses: [
          {
            use: "HOME" as const,
            type: "BOTH" as const,
            line1: formData.addressLine1,
            line2: formData.addressLine2 || undefined,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            country: formData.country,
            isPrimary: true,
          },
        ],
        telecoms: [
          {
            system: "PHONE" as const,
            value: formData.phone,
            use: "HOME" as const,
            isPrimary: true,
          },
          ...(formData.email ? [{
            system: "EMAIL" as const,
            value: formData.email,
            use: "HOME" as const,
            isPrimary: true,
          }] : []),
        ],
        emergencyContacts: formData.emergencyName
          ? [
              {
                name: formData.emergencyName,
                relationship: formData.emergencyRelationship,
                phone: formData.emergencyPhone,
                email: formData.emergencyEmail || undefined,
                isPrimary: true,
              },
            ]
          : [],
        insurancePolicies: formData.insuranceProvider
          ? [
              {
                payerName: formData.insuranceProvider,
                policyNumber: formData.policyNumber,
                groupNumber: formData.groupNumber || undefined,
                subscriberName: formData.subscriberName || formData.firstName + " " + formData.lastName,
                subscriberRelationship: "Self",
                isPrimary: true,
                isActive: true,
              },
            ]
          : [],
      };

      await createPatient.mutateAsync(patientData);
      router.push("/patients");
    } catch (err: any) {
      setError(err.message || "Failed to create patient");
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            {/* Essential Identity */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-500" /> Patient Identity
              </h3>
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">First Name <span className="text-rose-500">*</span></label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    placeholder="Enter first name"
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-cyan-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Middle Name</label>
                  <Input
                    value={formData.middleName}
                    onChange={(e) => updateField("middleName", e.target.value)}
                    placeholder="Enter middle name"
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-cyan-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Last Name <span className="text-rose-500">*</span></label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    placeholder="Enter last name"
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-cyan-500 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Date of Birth <span className="text-rose-500">*</span></label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField("dateOfBirth", e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-cyan-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Gender <span className="text-rose-500">*</span></label>
                  <select
                    value={formData.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* National & Health Identifiers */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-500" /> National Identifiers
              </h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1">Aadhaar Number</label>
                  <Input
                    value={formData.aadhaar}
                    onChange={(e) => updateField("aadhaar", e.target.value)}
                    placeholder="XXXX XXXX XXXX"
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-emerald-500 rounded-xl font-mono tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1">ABHA Health ID</label>
                  <Input
                    value={formData.abhaId}
                    onChange={(e) => updateField("abhaId", e.target.value)}
                    placeholder="XX-XXXX-XXXX-XXXX"
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:ring-emerald-500 rounded-xl font-mono tracking-widest"
                  />
                </div>
              </div>
            </div>

            {/* Additional Demographics */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => updateField("bloodGroup", e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Mother Tongue</label>
                  <select
                    value={formData.motherTongue}
                    onChange={(e) => updateField("motherTongue", e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <option value="">Select language</option>
                    <option value="English">English</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Marital Status</label>
                  <select
                    value={formData.maritalStatus}
                    onChange={(e) => updateField("maritalStatus", e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <option value="">Select status</option>
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Address Line 1 *</label>
              <Input
                value={formData.addressLine1}
                onChange={(e) => updateField("addressLine1", e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address Line 2</label>
              <Input
                value={formData.addressLine2}
                onChange={(e) => updateField("addressLine2", e.target.value)}
                placeholder="Apt, suite, unit, etc."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">City *</label>
                <Input
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State *</label>
                <Input
                  value={formData.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP Code *</label>
                <Input
                  value={formData.postalCode}
                  onChange={(e) => updateField("postalCode", e.target.value)}
                  placeholder="ZIP"
                />
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  Primary Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500 font-bold bg-slate-100 rounded-l-md border-r px-3 border-slate-200">
                    +91
                  </div>
                  <Input
                    value={formData.phone.replace(/^\+91\s*/, '')}
                    onChange={(e) => updateField("phone", `+91 ${e.target.value}`)}
                    placeholder="98765 43210"
                    className="pl-16 font-bold tracking-wider"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-500">Required for WhatsApp Rx, Teleconsultations, and ABHA Linking.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Name</label>
                <Input
                  value={formData.emergencyName}
                  onChange={(e) => updateField("emergencyName", e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Relationship</label>
                <Input
                  value={formData.emergencyRelationship}
                  onChange={(e) => updateField("emergencyRelationship", e.target.value)}
                  placeholder="e.g., Spouse, Parent, Friend"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  value={formData.emergencyPhone}
                  onChange={(e) => updateField("emergencyPhone", e.target.value)}
                  placeholder="(XXX) XXX-XXXX"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={formData.emergencyEmail}
                  onChange={(e) => updateField("emergencyEmail", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Insurance Provider</label>
              <Input
                value={formData.insuranceProvider}
                onChange={(e) => updateField("insuranceProvider", e.target.value)}
                placeholder="Insurance company name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Policy Number</label>
                <Input
                  value={formData.policyNumber}
                  onChange={(e) => updateField("policyNumber", e.target.value)}
                  placeholder="Policy number"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Group Number</label>
                <Input
                  value={formData.groupNumber}
                  onChange={(e) => updateField("groupNumber", e.target.value)}
                  placeholder="Group number (optional)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subscriber Name</label>
              <Input
                value={formData.subscriberName}
                onChange={(e) => updateField("subscriberName", e.target.value)}
                placeholder="Leave blank if same as patient"
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3">Demographics</h4>
              <div className="grid gap-2 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {formData.firstName} {formData.middleName} {formData.lastName}</p>
                <p><span className="text-muted-foreground">DOB:</span> {formData.dateOfBirth}</p>
                <p><span className="text-muted-foreground">Gender:</span> {formData.gender}</p>
                {formData.aadhaar && <p><span className="text-muted-foreground">Aadhaar:</span> {formData.aadhaar}</p>}
                {formData.abhaId && <p><span className="text-muted-foreground">ABHA ID:</span> {formData.abhaId}</p>}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3">Address & Contact</h4>
              <div className="grid gap-2 text-sm">
                <p>{formData.addressLine1}</p>
                {formData.addressLine2 && <p>{formData.addressLine2}</p>}
                <p>{formData.city}, {formData.state} {formData.postalCode}</p>
                <p><span className="text-muted-foreground">Phone:</span> {formData.phone}</p>
                {formData.email && <p><span className="text-muted-foreground">Email:</span> {formData.email}</p>}
              </div>
            </div>
            {formData.emergencyName && (
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Emergency Contact</h4>
                <div className="grid gap-2 text-sm">
                  <p>{formData.emergencyName} ({formData.emergencyRelationship})</p>
                  <p>{formData.emergencyPhone}</p>
                </div>
              </div>
            )}
            {formData.insuranceProvider && (
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Insurance</h4>
                <div className="grid gap-2 text-sm">
                  <p>{formData.insuranceProvider}</p>
                  <p>Policy: {formData.policyNumber}</p>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-6 p-4">
      {/* Left Sidebar Pane: Dark Gradient Premium Visual */}
      <div className="hidden lg:flex flex-col w-[380px] rounded-3xl overflow-hidden bg-slate-900 relative shadow-2xl p-8 justify-between flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <Link href="/patients" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 font-bold mb-10 transition-colors">
            <ArrowLeft className="h-5 w-5 mr-2" /> Back to Hub
          </Link>
          <h1 className="text-3xl font-black text-white mb-2 leading-tight">Patient<br/>Registration</h1>
          <p className="text-slate-400 text-sm mb-12">Capture secure, Indian-standard demographics and triage profiles.</p>

          {/* Vertical Stepper */}
          <div className="space-y-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 shadow-lg ${
                      isActive ? "border-emerald-400 bg-emerald-500 text-white shadow-emerald-500/30 scale-110" :
                      isCompleted ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400" :
                      "border-slate-700 bg-slate-800 text-slate-500"
                    }`}>
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                    </div>
                    {index !== steps.length - 1 && (
                      <div className={`w-0.5 h-12 mt-2 rounded-full ${isCompleted ? "bg-emerald-400/40" : "bg-slate-800"}`} />
                    )}
                  </div>
                  <div className={`pt-2 ${isActive ? "text-white" : isCompleted ? "text-emerald-100" : "text-slate-500"}`}>
                    <h3 className="font-bold text-sm">{step.title}</h3>
                    <p className="text-xs opacity-70 mt-1 hidden xl:block">
                      {index === 0 ? "Identity & basic details" : index === 1 ? "Where they live" : index === 2 ? "Who to contact" : index === 3 ? "Coverage details" : "Final check"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-600 font-mono">
          Metta Engine Security Layer <br/> v4.2.1 • Encrypted
        </div>
      </div>

      {/* Right Content Pane: Form */}
      <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-full relative">
        {/* Header / Current Step Context */}
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center shadow-inner">
              <CurrentIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{steps[currentStep].title}</h2>
              <p className="text-emerald-600 font-bold uppercase tracking-widest text-xs mt-1">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2 rounded-lg text-sm font-bold border border-rose-100">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-8 py-8 w-full">
          <div className="max-w-3xl mx-auto w-full">
            {renderStepContent()}
          </div>
        </div>

        {/* Sticky Footer Navigation */}
        <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center shadow-[0_-10px_30px_rgba(0,0,0,0.02)] flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="rounded-xl px-6 h-12 text-slate-600 font-bold hover:bg-slate-50 border-slate-200"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          
          {currentStep < steps.length - 1 ? (
            <Button onClick={handleNext} className="rounded-xl px-8 h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 transition-all hover:scale-105">
              Continue to {steps[currentStep + 1].title} <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createPatient.isPending}
              className="rounded-xl px-8 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
            >
              {createPatient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" /> Complete Registration
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
