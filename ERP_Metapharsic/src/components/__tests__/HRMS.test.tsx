
/**
 * HRMS Component Tests — AI-era HRMS UI rendering & interactions
 * Uses @testing-library/react + vitest
 * Run: npx vitest run src/components/__tests__/HRMS.test.tsx
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import HR from '../HR';

// Mock Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return { ...actual };
});

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    addNotification: vi.fn(),
    notifications: [],
    removeNotification: vi.fn(),
  }),
}));

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hr/employees')) return Promise.resolve({ success: true, data: [{ id: '1', name: 'John Doe', assignedArea: 'North' }] });
      if (url.includes('/hr/predictive-analytics')) return Promise.resolve({ success: true, data: { flightRisk: 2, hiringForecast: 5 } });
      if (url.includes('/hr/ats/candidates')) return Promise.resolve({ success: true, data: [{ id: 'c1', name: 'Alice Candidate', status: 'Sourced' }] });
      return Promise.resolve({ success: true, data: [] });
    }),
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hr/copilot')) return Promise.resolve({ success: true, response: "AI Response" });
      return Promise.resolve({ success: true });
    })
  }
}));

describe('Enterprise HRMS Component', () => {
  it('renders the multi-tab layout and AI insights', async () => {
    render(<HR />);
    
    expect(await screen.findByText(/AI Workforce Prediction/i)).toBeInTheDocument();
    expect(screen.getByText('Attrition Risk')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // flightRisk mock
  });

  it('switches to Talent & ATS tab and shows candidates', async () => {
    render(<HR />);
    
    const talentTab = screen.getByText(/Talent & ATS/i);
    fireEvent.click(talentTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Active Recruitment Pipeline/i)).toBeInTheDocument();
      expect(screen.getByText('Alice Candidate')).toBeInTheDocument();
    });
  });

  it('interacts with the AI Copilot', async () => {
    render(<HR />);
    
    const input = screen.getByPlaceholderText(/Ask Copilot.../i);
    fireEvent.change(input, { target: { value: 'How is performance?' } });
    
    const submitBtn = screen.getByRole('button', { name: '' }); // Submit btn uses icon
    fireEvent.click(submitBtn);
    
    await waitFor(() => {
      expect(screen.getByText('AI Response')).toBeInTheDocument();
    });
  });
});
