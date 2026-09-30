/**
 * Regression coverage for problematic failed commands in the unified table.
 * The former Failed tab no longer exists, but large and circular contexts
 * must not prevent failed commands or their neighbors from rendering.
 */

import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';
import { getCommands } from '@/app/agents/actions';
import { useRouter } from 'next/navigation';

jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: { id: 'site-1' } }),
}));

// Mock the dependencies before imports
jest.mock('@/app/agents/actions', () => {
  const mockCommands = [
    {
      id: 'failed-cmd-1',
      task: 'Failed command with large error',
      description: 'This is a failed command with a very large error context',
      status: 'failed',
      agent_id: 'agent-1',
      context: 'Error: '.repeat(5000) + 'Rate limit exceeded',
      created_at: new Date().toISOString(),
    },
    {
      id: 'failed-cmd-2', 
      task: 'Failed command with circular reference',
      description: 'This command has a circular reference in its data',
      status: 'failed',
      agent_id: 'agent-1',
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
  };
});

// Mock toast functionality
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('CommandsPanel failed-command regressions', () => {
  it('safely handles failed commands with problematic data', async () => {
    const push = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ ...useRouter(), push });
    render(<CommandsPanel />);

    const largeErrorRow = (await screen.findByText('Failed command with large error')).closest('tr');
    const circularErrorRow = screen.getByText('Failed command with circular reference').closest('tr');
    const completedRow = screen.getByText('Completed command').closest('tr');

    expect(getCommands).toHaveBeenCalledWith('site-1', 1);
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(within(largeErrorRow).getByText('Failed')).toBeInTheDocument();
    expect(within(circularErrorRow).getByText('Failed')).toBeInTheDocument();
    expect(within(completedRow).getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();

    fireEvent.click(largeErrorRow);
    fireEvent.click(circularErrorRow);
    expect(push.mock.calls).toEqual([
      ['/agents/agent-1/failed-cmd-1'],
      ['/agents/agent-1/failed-cmd-2'],
    ]);
  });
}); 