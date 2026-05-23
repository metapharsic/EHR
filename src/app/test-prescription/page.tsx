"use client";

import { useState } from "react";

export default function TestPrescriptionPage() {
  const [diagnosis, setDiagnosis] = useState("Hypertension");
  const [symptoms, setSymptoms] = useState("headache, dizziness");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const testMedicationAPI = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis,
          symptoms: symptoms.split(",").map(s => s.trim()),
          transcript: `Patient presents with ${symptoms}. Diagnosis: ${diagnosis}`,
          patientAllergies: [],
          currentMedications: [],
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "API request failed");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const testPrescriptionAPI = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: "p-123",
          diagnosis: "Hypertension",
          items: [
            {
              medicationId: "med-1",
              dosage: "1 tablet",
              frequency: "once daily",
              route: "oral",
              duration: "30 days",
              quantity: 30,
              instructions: "Take in the morning",
              refills: 2,
            },
          ],
          conversationContext: "Patient has high blood pressure",
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "API request failed");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Prescription System Test</h1>

        {/* Test 1: Medication Suggestions */}
        <div className="mb-8 p-6 bg-slate-900 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Test 1: AI Medication Suggestions</h2>
          
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Diagnosis</label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Symptoms (comma separated)</label>
              <input
                type="text"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 text-white rounded border border-slate-600"
              />
            </div>
          </div>

          <button
            onClick={testMedicationAPI}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Testing..." : "Test Medication API"}
          </button>
        </div>

        {/* Test 2: Create Prescription */}
        <div className="mb-8 p-6 bg-slate-900 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Test 2: Create Prescription</h2>
          <button
            onClick={testPrescriptionAPI}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Testing..." : "Test Prescription API"}
          </button>
        </div>

        {/* Results */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-400 font-semibold">Error:</p>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-2">Result:</h3>
            <pre className="text-sm text-slate-300 overflow-auto max-h-96 bg-slate-950 p-4 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <a
            href="/prescribe?patientId=p-123"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
          >
            Open Full Prescription UI
          </a>
        </div>
      </div>
    </div>
  );
}
