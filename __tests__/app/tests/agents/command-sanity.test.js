/**
 * Basic sanity test for commands panel
 * This test verifies that the panel doesn't crash with problematic data
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';

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
  getMockCommands: jest.fn().mockResolvedValue([]),
}));

// Mock UI components
jest.mock('@/app/components/ui/icons', () => {
  return {
    Check: () => <div data-testid="icon-check" />,
    AlertCircle: () => <div data-testid="icon-alert" />,
    Clock: () => <div data-testid="icon-clock" />,
    FileText: () => <div data-testid="icon-file" />,
    RotateCcw: () => <div data-testid="icon-rotate" />,
    PlayCircle: () => <div data-testid="icon-play" />
  };
});

// Mock toast functionality
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

// Mock command components
jest.mock('@/app/components/agents/command-list', () => ({
  CommandList: ({ commands }) => (
    <div data-testid="command-list">
      {commands.map(cmd => (
        <div key={cmd.id} data-testid="command-item">
          {cmd.task}
        </div>
      ))}
    </div>
  )
}));

describe('CommandsPanel - Basic sanity tests', () => {
  it('renders without crashing with failed command data', async () => {
    // Create a custom container to inject into the DOM
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    render(<CommandsPanel />, { container });
    
    // Verify component renders
    expect(container.querySelector('[data-testid="commands-panel"]')).toBeTruthy();
    
    // Verify the failed tab shows 1 command (the default tab is "completed")
    await waitFor(() => {
      expect(container.querySelector('[data-testid="tab-failed"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="tab-failed"]').textContent).toContain('(1)');
    });
    
    // The test is successful if it renders without crashing - that's our main assertion
    // The component successfully handling the large error context is a pass
  });
}); 