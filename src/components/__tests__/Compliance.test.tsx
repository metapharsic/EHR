
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Compliance from '../Compliance';

// Mock fetch
global.fetch = vi.fn((url: string) => {
  if (url.includes('/risk-score')) {
    return Promise.resolve({
      json: () => Promise.resolve({ success: true, data: { score: 85, level: 'Critical', factors: [{ name: 'Expiring', impact: 'High' }] } })
    });
  }
  return Promise.resolve({
    json: () => Promise.resolve({ success: true, data: [] })
  });
}) as any;

describe('Compliance AI Enhancement', () => {
  it('renders risk score dashboard correctly', async () => {
    render(<Compliance />);
    await waitFor(() => {
      expect(screen.getByText(/AI Compliance Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/85/)).toBeInTheDocument();
      expect(screen.getByText(/Critical RISK/i)).toBeInTheDocument();
    });
  });
});
