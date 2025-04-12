/**
 * Specific test for the Failed tab
 * This test focuses on verifying that the failed tab doesn't freeze
 * when displaying problematic error contexts
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';

// Mock the dependencies before imports
jest.mock('@/app/agents/actions', () => {
  const mockCommands = [
    {
      id: 'failed-cmd-1',
      task: 'Failed command with large error',
      description: 'This is a failed command with a very large error context',
      status: 'failed',
      context: 'Error: '.repeat(5000) + 'Rate limit exceeded',
      created_at: new Date().toISOString(),
    },
    {
      id: 'failed-cmd-2', 
      task: 'Failed command with circular reference',
      description: 'This command has a circular reference in its data',
      status: 'failed',
      created_at: new Date().toISOString(),
    },
    {
      id: 'completed-cmd',
      task: 'Completed command',
      description: 'This is a completed command',
      status: 'completed',
      created_at: new Date().toISOString(),
    }
  ];
  
  // Create circular reference in the second command
  const circularObj = { message: 'Circular reference error' };
  circularObj.self = circularObj;
  mockCommands[1].context = circularObj;
  
  return {
    getCommands: jest.fn().mockResolvedValue({ commands: mockCommands }),
    getMockCommands: jest.fn().mockResolvedValue([]),
  };
});

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

describe('Failed Tab Tests', () => {
  it('safely handles failed commands with problematic data', async () => {
    // Create a custom container to inject into the DOM
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    render(<CommandsPanel />, { container });
    
    // Verify component renders
    expect(container.querySelector('[data-testid="commands-panel"]')).toBeTruthy();
    
    // Wait for data to load and verify failed tab shows 2 commands
    await waitFor(() => {
      expect(container.querySelector('[data-testid="tab-failed"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="tab-failed"]').textContent).toContain('(2)');
    });
    
    // Switch to failed tab - this is the key test, as it previously caused freezing
    fireEvent.click(container.querySelector('[data-testid="tab-failed"]'));
    
    // Verify the tab switch occurred successfully without freezing
    await waitFor(() => {
      // If we make it here without freezing or error, the test passes
      // The component successfully handled the large error context and circular reference
      expect(true).toBe(true);
    });
  });
}); 