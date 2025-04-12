/**
 * @jest-environment jsdom
 * 
 * Integration test for commands panel
 * These tests verify that the panel components can handle problematic data structures
 * without crashing or freezing the application.
 */

import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { CommandsPanel } from '@/app/components/agents/commands-panel';
import { Command } from '@/app/agents/types';

// Mock the dependencies
jest.mock('@/app/agents/actions', () => ({
  getCommands: jest.fn().mockResolvedValue({ commands: [] }),
  getMockCommands: jest.fn().mockResolvedValue([]),
}));

// Mock toast functionality
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

// Get the mocked functions
import { getCommands, getMockCommands } from '@/app/agents/actions';

// Helper to create problematic command data
function createProblematicCommand(type: string): Command {
  switch (type) {
    case 'circular':
      const circular: any = {
        id: 'circular-cmd',
        task: 'Command with circular structure',
        description: 'This command has a circular reference',
        status: 'failed',
        created_at: new Date().toISOString(),
      };
      // Create circular reference
      circular.self = circular;
      return circular;
      
    case 'deep':
      // Create deeply nested object
      function createDeep(depth: number): any {
        if (depth <= 0) return { value: 'leaf' };
        return { 
          child: createDeep(depth - 1),
          value: `depth-${depth}`
        };
      }
      
      return {
        id: 'deep-nest',
        task: 'Command with deep nesting',
        description: 'This command has deeply nested objects',
        status: 'completed',
        created_at: new Date().toISOString(),
        results: [createDeep(100)], // Very deep nesting
      };
      
    case 'large-array':
      return {
        id: 'large-array',
        task: 'Command with large arrays',
        description: 'This command has extremely large arrays',
        status: 'completed',
        created_at: new Date().toISOString(),
        results: Array(10000).fill(null).map((_, i) => ({ 
          id: `item-${i}`, 
          value: `Value ${i}` 
        })),
      };
      
    case 'large-error':
      return {
        id: 'large-error',
        task: 'Command with large error message',
        description: 'This command has a very large error message',
        status: 'failed',
        created_at: new Date().toISOString(),
        context: 'Error: '.repeat(10000) + 'Something went wrong',
      };
      
    case 'invalid-date':
      return {
        id: 'invalid-date',
        task: 'Command with invalid date format',
        description: 'This command has invalid date strings',
        status: 'completed',
        created_at: 'not-a-date',
        updated_at: '2023-99-99', // Invalid date
        completion_date: null as any,
      };
      
    default:
      return {
        id: 'normal',
        task: 'Normal command',
        description: 'This is a normal command',
        status: 'completed',
        created_at: new Date().toISOString(),
      };
  }
}

// Mock components
jest.mock('@/app/components/ui/icons', () => {
  const originalModule = jest.requireActual('@/app/components/ui/icons');
  return {
    ...originalModule,
    Check: () => <div data-testid="check-icon" />,
    AlertCircle: () => <div data-testid="alert-icon" />,
    Clock: () => <div data-testid="clock-icon" />,
    FileText: () => <div data-testid="file-icon" />,
    RotateCcw: () => <div data-testid="rotate-icon" />,
    PlayCircle: () => <div data-testid="play-icon" />
  };
});

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

describe('CommandsPanel - Edge Case Integration Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  
  test('should handle commands with circular references', async () => {
    // Mock the API to return a command with circular references
    const circularCommand = createProblematicCommand('circular');
    (getCommands as jest.Mock).mockResolvedValue({
      commands: [circularCommand]
    });
    
    // There should be no crashes when rendering
    render(<CommandsPanel />);
    
    // Wait for the component to load
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    // Force load completed
    await waitFor(() => {
      expect(screen.getByText('Command with circular structure')).toBeInTheDocument();
    });
  });
  
  test('should handle commands with deeply nested structures', async () => {
    const deepCommand = createProblematicCommand('deep');
    (getCommands as jest.Mock).mockResolvedValue({
      commands: [deepCommand]
    });
    
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(screen.getByText('Command with deep nesting')).toBeInTheDocument();
    });
  });
  
  test('should handle commands with extremely large arrays', async () => {
    const largeArrayCommand = createProblematicCommand('large-array');
    (getCommands as jest.Mock).mockResolvedValue({
      commands: [largeArrayCommand]
    });
    
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(screen.getByText('Command with large arrays')).toBeInTheDocument();
    });
  });
  
  test('should handle commands with large error messages', async () => {
    const largeErrorCommand = createProblematicCommand('large-error');
    (getCommands as jest.Mock).mockResolvedValue({
      commands: [largeErrorCommand]
    });
    
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    // No need to switch tabs in this test
    await waitFor(() => {
      expect(screen.getByText('Command with large error message')).toBeInTheDocument();
    });
  });
  
  test('should handle commands with invalid date formats', async () => {
    const invalidDateCommand = createProblematicCommand('invalid-date');
    (getCommands as jest.Mock).mockResolvedValue({
      commands: [invalidDateCommand]
    });
    
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(screen.getByText('Command with invalid date format')).toBeInTheDocument();
    });
  });
  
  test('should handle a mix of problematic commands', async () => {
    const mixedCommands = [
      createProblematicCommand('circular'),
      createProblematicCommand('deep'),
      createProblematicCommand('large-array'),
      createProblematicCommand('large-error'),
      createProblematicCommand('invalid-date'),
    ];
    
    (getCommands as jest.Mock).mockResolvedValue({
      commands: mixedCommands
    });
    
    render(<CommandsPanel />);
    
    await waitFor(() => {
      expect(getCommands).toHaveBeenCalled();
    });
    
    // Verify at least some commands are visible
    await waitFor(() => {
      expect(screen.getByText('Command with circular structure')).toBeInTheDocument();
    });
  });
}); 