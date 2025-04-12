import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';
import { CommandList } from '@/app/components/agents/command-list';
import { Command } from '@/app/agents/types';
import { getCommands, getMockCommands } from '@/app/agents/actions';

// Type for test options
interface CommandTestOptions {
  initialCommands?: Command[];
  mockErrors?: boolean;
  filterStatus?: 'all' | 'completed' | 'running' | 'failed';
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
    
    // Wait for initial render to complete
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    // Select a specific tab if requested
    if (options.filterStatus && options.filterStatus !== 'all') {
      fireEvent.click(screen.getByText(options.filterStatus.charAt(0).toUpperCase() + options.filterStatus.slice(1)));
      await waitFor(() => {
        // Wait for tab switch to complete
      });
    }
    
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
      // Determine status based on distribution
      let status: 'completed' | 'running' | 'failed';
      const rand = Math.random();
      if (rand < statusDistribution.completed) {
        status = 'completed';
      } else if (rand < statusDistribution.completed + statusDistribution.running) {
        status = 'running';
      } else {
        status = 'failed';
      }
      
      return {
        id: `test-cmd-${i}`,
        task: `Test Task ${i}`,
        description: `Test description for task ${i}`,
        status,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        context: status === 'failed' ? `Error: Test error for task ${i}` : undefined,
        duration: status === 'completed' ? Math.floor(Math.random() * 10000) : undefined,
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
  },
  
  /**
   * Helper to trigger the refresh action on CommandsPanel
   */
  triggerRefresh: async () => {
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalledTimes(2); // Once on initial render, once on refresh
    });
  }
}; 