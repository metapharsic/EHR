import { GoogleGenAI } from "@google/genai";
import { Product, SalesInvoice } from '../types';

let ai: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!ai && process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const generateSmartInsights = async (
  query: string,
  contextData: { products: Product[]; invoices: SalesInvoice[]; }
): Promise<string> => {
  const client = getAIClient();
  if (!client) return "Please configure your API Key to use Smart Insights.";

  try {
    const dataContext = `
      Current Date: ${new Date().toLocaleDateString()}
      Inventory Summary: ${contextData.products.length} products.
      Low Stock Items: ${contextData.products.filter(p => p.stock < p.minStockLevel).map(p => p.name).join(', ')}.
      Recent Invoices Count: ${contextData.invoices.length}.
      Total Sales Value (Mock): ${contextData.invoices.reduce((acc, curr) => acc + curr.netAmount, 0)}.
      Product Details Sample: ${JSON.stringify(contextData.products.slice(0, 5))}.
    `;

    const systemInstruction = `
      You are an AI assistant for a Pharmacy Management System.
      Analyze the provided store data context and answer the user's query briefly and professionally.
      If the user asks for analysis, provide insights based on the data.
      Keep answers under 50 words unless detailed analysis is requested.
      Formatting: Use Markdown for lists or bold text.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context Data:\n${dataContext}\n\nUser Query: ${query}`,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "I couldn't generate an insight at this moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error connecting to Smart Assistant.";
  }
};