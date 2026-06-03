/**
 * server/services/aiCrmAgent.js
 * Agentic AI service for CRM module using Google GenAI (Gemini).
 * Handles lead scoring, sentiment analysis, and automated communication.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

// Initialize Gemini if key is available
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * AI Scoring Agent: Analyzes lead details and activities to assign a score.
 */
async function calculateLeadScore(lead, activities = []) {
    if (!genAI) {
        // Fallback simple scoring logic if AI is not configured
        let score = 50;
        if (lead.estimated_value > 100000) score += 20;
        if (activities.length > 3) score += 15;
        if (lead.status === 'Negotiation') score += 10;
        return { 
            score: Math.min(score, 100), 
            sentiment: score > 70 ? 'Hot' : score > 40 ? 'Warm' : 'Cold',
            reason: "Heuristic-based scoring (AI not configured)"
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            Analyze this sales lead and their recent activities. 
            Lead: ${JSON.stringify(lead)}
            Activities: ${JSON.stringify(activities)}
            
            Based on this data, provide:
            1. A lead score from 0-100 (probability of conversion).
            2. Sentiment ('Hot', 'Warm', 'Cold').
            3. A short reason (1 sentence).
            
            Return ONLY a valid JSON object in this format:
            {"score": number, "sentiment": "string", "reason": "string"}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(text.replace(/```json|```/g, ""));
    } catch (error) {
        logger.error("AI Lead Scoring Error", { error: error.message });
        return { score: 50, sentiment: 'Neutral', reason: "AI Analysis failed" };
    }
}

/**
 * Communication Agent: Drafts a contextual follow-up email.
 */
async function draftFollowUp(lead, interests = []) {
    if (!genAI) return "AI not configured for drafting.";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            Draft a professional and personalized follow-up email for a pharmaceutical sales lead.
            Lead Name: ${lead.name}
            Company: ${lead.company_name}
            Products of Interest: ${interests.map(i => i.product_name).join(", ")}
            Last Activity: ${lead.last_activity_at || 'Never'}
            
            Tone: Professional, helpful, pharmaceutical industry standard.
            Include: A call to action.
            
            Return ONLY the email body text.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        logger.error("AI Communication Agent Error", { error: error.message });
        return "Failed to generate draft. Please write manually.";
    }
}

async function generateWeeklyStrategy(leads, demandData) {
    if (!genAI) {
        return {
            priorityLeads: leads.slice(0, 3).map(l => ({ id: l.id, name: l.name, reason: "Fallback: high estimated value" })),
            marketInsight: "AI not configured. Using value-based prioritization.",
            recommendedActions: ["Follow up with top 3 value leads", "Check inventory for stock availability"]
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a Pharmaceutical Sales Strategy Agent.
            Analyze these leads and regional market demand to create a weekly strategy.
            
            Leads: ${JSON.stringify(leads)}
            Regional Demand: ${JSON.stringify(demandData)}
            
            Based on this:
            1. Identify the top 5 priority leads to follow up with this week.
            2. For each, provide a specific "Agentic Reason" why they are prioritized (cross-reference lead location/interest with demand data).
            3. Provide a brief overall market insight summary.
            4. Suggest 3 high-level strategy actions.
            
            Return ONLY a valid JSON object in this format:
            {
                "priorityLeads": [{"id": "uuid", "name": "string", "reason": "string"}],
                "marketInsight": "string",
                "recommendedActions": ["string", "string", "string"]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return JSON.parse(text.replace(/```json|```/g, ""));
    } catch (error) {
        logger.error("AI Strategy Generation Error", { error: error.message });
        return { 
            priorityLeads: [], 
            marketInsight: "Failed to generate AI strategy.", 
            recommendedActions: ["Manual review required"] 
        };
    }
}

module.exports = {
    calculateLeadScore,
    draftFollowUp,
    generateWeeklyStrategy
};
