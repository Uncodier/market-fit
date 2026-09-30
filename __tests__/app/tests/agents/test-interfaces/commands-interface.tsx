import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';
import { CommandList } from '@/app/components/agents/command-list';
import { Command } from '@/app/agents/types';
import { getCommands } from '@/app/agents/actions';

// Type for test options
interface CommandTestOptions {
  initialCommands?: Command[];
  mockErrors?: boolean;
}

/**
 * Commands Test Interface
 * Provides utilities for testing command-related components
 */
export const CommandsTestInterface = {
  /**
   * Renders the CommandsPanel component with test configurations
   */
  renderCommandsPanel: async (options: CommandTestOptions = {}) => {
    const { initialCommands = [], mockErrors = false } = options;
    
    // Setup mocks
    (getCommands as jest.Mock).mockResolvedValue({ 
      commands: initialCommands,
      error: mockErrors ? 'Mock error' : undefined
    });
    
    const result = render(<CommandsPanel />);
    
    // Wait for the response to render, not merely for the request to start.
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });
    
    return result;
  },
  
  /**
   * Renders the CommandList component with test configurations
   */
  renderCommandList: (commands: Command[] = [], hasError: boolean = false) => {
    return render(<CommandList commands={commands} hasError={hasError} />);
  },
  
  /**
   * Creates command test fixtures with various statuses
   */
  createTestCommands: (count: number = 10, distribution: Record<string, number> = {}) => {
    const defaultDistribution = { completed: 0.5, running: 0.3, failed: 0.2 };
    const statusDistribution = { ...defaultDistribution, ...distribution };
    
    return Array(count).fill(null).map((_, i) => {
      // Use deterministic positions so repeated test runs have the same statuses.
      let status: 'completed' | 'running' | 'failed';
      const position = i / count;
      if (position < statusDistribution.completed) {
        status = 'completed';
      } else if (position < statusDistribution.completed + statusDistribution.running) {
        status = 'running';
      } else {
        status = 'failed';
      }
      
      return {
        id: `test-cmd-${status}-${i}`,
        task: `Test Task ${status} ${i}`,
        description: `Test description for ${status} task ${i}`,
        status,
        created_at: new Date(Date.UTC(2023, 0, 1, 12) - i * 60000).toISOString(),
        context: status === 'failed' ? `Error: Test error for task ${i}` : undefined,
        duration: status === 'completed' ? (i + 1) * 1000 : undefined,
        results: status === 'completed' ? [{ message: `Result for task ${i}` }] : undefined
      } as Command;
    });
  },
  
  /**
   * Verifies expected commands are displayed in the UI
   */
  expectCommandsDisplayed: (commands: Command[]) => {
    commands.forEach(command => {
      expect(screen.getByText(command.task)).toBeInTheDocument();
      if (command.description) {
        expect(screen.getByText(command.description)).toBeInTheDocument();
      }
    });
  }
}; 