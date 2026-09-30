/**
 * Basic sanity test for commands panel
 * This test verifies that the panel doesn't crash with problematic data
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';
import { getCommands } from '@/app/agents/actions';

jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: { id: 'site-1' } }),
}));

// Mock the dependencies before imports
jest.mock('@/app/agents/actions', () => ({
  getCommands: jest.fn().mockResolvedValue({ 
    commands: [
      {
        id: 'failed-cmd',
        task: 'Failed command',
        description: 'This is a failed command',
        status: 'failed',
        context: 'Error: '.repeat(500) + 'Something went wrong',
        created_at: new Date().toISOString(),
      }
    ] 
  }),
}));

// Mock toast functionality
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('CommandsPanel - Basic sanity tests', () => {
  it('renders without crashing with failed command data', async () => {
    render(<CommandsPanel />);

    expect(screen.getByTestId('commands-panel')).toBeInTheDocument();
    const row = (await screen.findByText('Failed command')).closest('tr');

    expect(getCommands).toHaveBeenCalledWith('site-1', 1);
    expect(within(row).getByText('This is a failed command')).toBeInTheDocument();
    expect(within(row).getByText('Failed')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });
}); 