import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase() || "";

    // Simulated network delay for AI processing feel
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // --- AGENTIC INTENT PARSER ---
    // If the query looks like a complex intent, we generate an autonomous action.
    let autonomousActions: any[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Example Intent: "Refill Metformin 500mg for Raj Kumar for 3 months and send WhatsApp"
    if (lowerQuery.includes("refill") || lowerQuery.includes("prescribe")) {
      // NLP simulation for demo
      const hasDrug = lowerQuery.includes("metformin") ? "Metformin 500mg" : (lowerQuery.includes("drug") ? "Medication" : null);
      const hasPatient = lowerQuery.includes("raj") ? "Raj Kumar" : "Selected Patient";
      const hasDuration = lowerQuery.includes("months") ? "3 Months" : "1 Month";
      const hasChannel = lowerQuery.includes("whatsapp") ? "WhatsApp" : "SMS";

      if (hasDrug || lowerQuery.length > 15) {
        autonomousActions.push({
          type: "autonomous agent",
          title: `Autonomous Action: ${lowerQuery.includes("refill") ? "Refill" : "Prescribe"} ${hasDrug || "Medication"}`,
          subtitle: `Patient: ${hasPatient} • Duration: ${hasDuration} • Notify: ${hasChannel}`,
          iconName: "Sparkles",
          href: "#",
          isExecutable: true,
          actionPayload: {
            drug: hasDrug,
            patient: hasPatient,
            duration: hasDuration,
            notification: hasChannel
          }
        });
      }
    }
    // -----------------------------

    // Static application navigations
    const PAGES = [
      { type: "page", title: "Dashboard", subtitle: "Overview and metrics", iconName: "LayoutDashboard", href: "/" },
      { type: "page", title: "Schedule", subtitle: "Appointment management", iconName: "Calendar", href: "/schedule" },
      { type: "page", title: "Prescribe", subtitle: "Medications & prescriptions", iconName: "ClipboardList", href: "/prescribe" },
      { type: "page", title: "Transcript", subtitle: "Clinical notes & AI scribe", iconName: "FileText", href: "/transcript" },
      { type: "page", title: "Patients Hub", subtitle: "Patient registry and intake", iconName: "Users", href: "/patients" },
      { type: "page", title: "Predictive Timeline", subtitle: "AI health forecasting", iconName: "TrendingUp", href: "/predictive-timeline" },
      { type: "page", title: "WhatsApp Sync", subtitle: "Triage remote patients", iconName: "MessageCircle", href: "/whatsapp-sync" },
      { type: "page", title: "Settings", subtitle: "System configurations", iconName: "Settings", href: "/admin" },
    ];

    // AI specific tasks/actions
    const AI_ACTIONS = [
      { type: "ai action", title: "Draft WhatsApp Reply", subtitle: "Generate AI response for patient queries", iconName: "Sparkles", href: "/whatsapp-sync" },
      { type: "ai action", title: "Start Voice Consult", subtitle: "Trilingual audio assessment", iconName: "Mic", href: "/transcript" },
      { type: "ai action", title: "Analyze Lab Reports", subtitle: "Extract vitals using OCR", iconName: "Brain", href: "/documents" },
    ];

    // Patients lookup (simulating DB query)
    const MOCK_PATIENTS = [
      { type: "patient", title: "John Smith", subtitle: "MRN2024001 • 41y • MALE", iconName: "User", href: "/patients" },
      { type: "patient", title: "Maria Garcia", subtitle: "MRN2024002 • 35y • FEMALE", iconName: "User", href: "/patients" },
      { type: "patient", title: "Robert Johnson", subtitle: "MRN2024003 • 50y • MALE", iconName: "User", href: "/patients" },
      { type: "patient", title: "Rajesh Kumar", subtitle: "ABHA: 91-7689-0021 • Active Diabetes", iconName: "User", href: "/patients" },
      { type: "patient", title: "Priya Sharma", subtitle: "ABHA: 91-4521-9980 • Urgent Care", iconName: "User", href: "/patients" },
      { type: "patient", title: "Sneha Reddy", subtitle: "+91 98765 43210 • Walk-in", iconName: "User", href: "/patients/new" },
    ];

    const allData = [...PAGES, ...AI_ACTIONS, ...MOCK_PATIENTS];

    // Basic NLP-like fuzzy matching
    let results = allData.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      item.subtitle.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    );

    // Prioritize Autonomous Actions
    results = [...autonomousActions, ...results.slice(0, 7)];

    return NextResponse.json({ results }); // Return max 8 matches

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
