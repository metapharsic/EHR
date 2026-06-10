/**
 * Smart Assistant service — delegates to the backend /api/ai/ask endpoint.
 * Real DB data is fetched server-side; no API key exposure in the browser bundle.
 */
export const generateSmartInsights = async (query: string): Promise<string> => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (!token) return 'Please log in to use the Smart Assistant.';

  try {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return data.error || 'Smart Assistant is temporarily unavailable.';
    }
    return data.answer;
  } catch {
    return 'Error connecting to Smart Assistant.';
  }
};
