import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';
import { getCommands, getMockCommands } from '@/app/agents/actions';
import { Command } from '@/app/agents/types';

// Mock dependencies
jest.mock('@/app/agents/actions', () => ({
  getCommands: jest.fn(),
  getMockCommands: jest.fn(),
}));

// Mock toast functionality
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('CommandsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state', () => {
    (getCommands as jest.Mock).mockResolvedValue({ commands: [] });
    
    render(<CommandsPanel />);
    
    expect(screen.getAllByTestId('loading-skeleton')).toHaveLength(3);
  });

  test('renders empty state when no commands are available', async () => {
    (getCommands as jest.Mock).mockResolvedValue({ commands: [] });
    
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('No commands found')).toBeInTheDocument();
    });
  });

  test('handles failed commands correctly', async () => {
    const failedCommand: Command = {
      id: 'failed-command',
      task: 'Failed Task',
      description: 'This task failed',
      status: 'failed',
      context: 'Error: Something went wrong',
      created_at: new Date().toISOString(),
    };
    
    (getCommands as jest.Mock).mockResolvedValue({ commands: [failedCommand] });
    
    render(<CommandsPanel />);
    
    // Wait for commands to load and switch to failed tab
    await waitFor(() => {
      fireEvent.click(screen.getByText('Failed'));
    });
    
    // Verify the failed command is displayed
    expect(screen.getByText('Failed Task')).toBeInTheDocument();
    expect(screen.getByText('This task failed')).toBeInTheDocument();
  });

  test('handles large context in failed commands', async () => {
    // Create a very large error context (potentially problematic)
    const largeContext = 'Error: '.repeat(1000);
    
    const commandWithLargeError: Command = {
      id: 'large-error',
      task: 'Task with large error',
      description: 'This task has a very large error context',
      status: 'failed',
      context: largeContext,
      created_at: new Date().toISOString(),
    };
    
    (getCommands as jest.Mock).mockResolvedValue({ commands: [commandWithLargeError] });
    
    render(<CommandsPanel />);
    
    // Switch to failed tab
    await waitFor(() => {
      fireEvent.click(screen.getByText('Failed'));
    });
    
    // Verify that the command is displayed without crashing
    expect(screen.getByText('Task with large error')).toBeInTheDocument();
  });

  test('handles deeply nested results structure', async () => {
    // Create a command with deeply nested results (potentially problematic)
    const makeNestedObject = (depth: number, prefix = '') => {
      if (depth <= 0) return `${prefix}Value`;
      
      const obj: Record<string, any> = {};
      for (let i = 0; i < 5; i++) {
        obj[`${prefix}Key${i}`] = makeNestedObject(depth - 1, `${prefix}${i}_`);
      }
      return obj;
    };
    
    const deeplyNestedCommand: Command = {
      id: 'nested-results',
      task: 'Task with deeply nested results',
      description: 'This task has complex nested results',
      status: 'completed',
      created_at: new Date().toISOString(),
      results: [makeNestedObject(10, 'deep_')],
    };
    
    (getCommands as jest.Mock).mockResolvedValue({ commands: [deeplyNestedCommand] });
    
    render(<CommandsPanel />);
    
    // Verify the command is displayed without crashing
    await waitFor(() => {
      expect(screen.getByText('Task with deeply nested results')).toBeInTheDocument();
    });
  });

  test('handles circular references in command data', async () => {
    // Create an object with circular references
    const circularObj: Record<string, any> = {
      name: 'Circular Object',
      description: 'This object has circular references'
    };
    circularObj.self = circularObj; // Create circular reference
    
    const circularCommand: Command = {
      id: 'circular-ref',
      task: 'Task with circular reference',
      description: 'This has circular data structures',
      status: 'completed',
      created_at: new Date().toISOString(),
      // @ts-ignore - Intentionally adding a circular reference for testing
      results: [circularObj],
    };
    
    (getCommands as jest.Mock).mockResolvedValue({ commands: [circularCommand] });
    
    // This should render without crashing despite the circular reference
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Task with circular reference')).toBeInTheDocument();
    });
  });

  test('handles extremely large number of commands', async () => {
    // Create many commands to test performance handling
    const manyCommands = Array(500).fill(null).map((_, i) => ({
      id: `cmd-${i}`,
      task: `Task ${i}`,
      description: `Description ${i}`,
      status: i % 3 === 0 ? 'completed' : (i % 3 === 1 ? 'running' : 'failed'),
      created_at: new Date().toISOString(),
    } as Command));
    
    (getCommands as jest.Mock).mockResolvedValue({ commands: manyCommands });
    
    render(<CommandsPanel />);
    
    // Verify that some maximum limited amount is displayed
    await waitFor(() => {
      // The components should show some indication of limited results
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });
  });
}); 