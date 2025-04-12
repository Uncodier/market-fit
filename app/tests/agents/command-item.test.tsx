import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandItem, Command } from '@/app/components/agents/command-item';

describe('CommandItem', () => {
  const baseCommand: Command = {
    id: 'test-cmd-1',
    name: 'Test Command',
    description: 'This is a test command',
    status: 'completed',
    timestamp: '2023-01-01T12:00:00Z',
    duration: '2.5s'
  };

  test('renders command data correctly', () => {
    render(<CommandItem command={baseCommand} />);
    
    expect(screen.getByText('Test Command')).toBeInTheDocument();
    expect(screen.getByText('This is a test command')).toBeInTheDocument();
    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });

  test('renders correct status badge for completed commands', () => {
    render(<CommandItem command={baseCommand} />);
    
    const badge = screen.getByText('Completed');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.text-success')).toBeInTheDocument();
  });

  test('renders correct status badge for failed commands', () => {
    const failedCommand: Command = {
      ...baseCommand,
      status: 'failed',
      errorMessage: 'Error: Something went wrong'
    };
    
    render(<CommandItem command={failedCommand} />);
    
    const badge = screen.getByText('Failed');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.text-destructive')).toBeInTheDocument();
    expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
  });

  test('renders correct status badge for pending commands', () => {
    const pendingCommand: Command = {
      ...baseCommand,
      status: 'pending'
    };
    
    render(<CommandItem command={pendingCommand} />);
    
    const badge = screen.getByText('Pending');
    expect(badge).toBeInTheDocument();
  });

  test('expands and collapses details when clicking on a command with details', () => {
    const commandWithDetails: Command = {
      ...baseCommand,
      originalCommand: {
        id: 'test-cmd-1',
        task: 'Test Command',
        description: 'This is a test command',
        status: 'completed',
        created_at: '2023-01-01T12:00:00Z',
        completion_date: '2023-01-01T12:02:30Z',
        duration: 150000,
        model: 'claude-3'
      }
    };
    
    render(<CommandItem command={commandWithDetails} />);
    
    // Details should be hidden initially
    expect(screen.queryByText('General Information')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(screen.getByText('Test Command'));
    
    // Details should now be visible
    expect(screen.getByText('General Information')).toBeInTheDocument();
    expect(screen.getByText('Model:')).toBeInTheDocument();
    expect(screen.getByText('claude-3')).toBeInTheDocument();
    
    // Click again to collapse
    fireEvent.click(screen.getByText('Test Command'));
    
    // Details should be hidden again
    expect(screen.queryByText('General Information')).not.toBeInTheDocument();
  });

  test('handles JSON error messages', () => {
    const jsonErrorCommand: Command = {
      ...baseCommand,
      status: 'failed',
      errorMessage: JSON.stringify({
        error: 'API_ERROR',
        message: 'Failed to connect to API',
        code: 500
      })
    };
    
    render(<CommandItem command={jsonErrorCommand} />);
    
    // It should parse and display the JSON error
    expect(screen.getByText(/API_ERROR/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to connect to API/)).toBeInTheDocument();
  });

  test('safely handles complex nested results', () => {
    const complexResultsCommand: Command = {
      ...baseCommand,
      name: 'Test Command',
      originalCommand: {
        id: 'complex-results',
        task: 'Complex Results',
        description: 'Command with complex results',
        status: 'completed',
        created_at: '2023-01-01T12:00:00Z',
        results: [
          {
            topic: 'Main Topic',
            score: 0.95,
            volume: 1250,
            details: {
              subtopics: ['Subtopic 1', 'Subtopic 2', 'Subtopic 3'],
              metrics: {
                engagement: 0.75,
                conversion: 0.25
              }
            }
          }
        ]
      }
    };
    
    render(<CommandItem command={complexResultsCommand} />);
    
    // Click to expand
    fireEvent.click(screen.getByText('Test Command'));
    
    // Click on Results accordion item
    fireEvent.click(screen.getByText('Results'));
    
    // Should show the topic
    expect(screen.getByText('Main Topic')).toBeInTheDocument();
    // Should show the score
    expect(screen.getByText(/Score: 95%/)).toBeInTheDocument();
    // Should show the volume (adjust to match the actual rendered format)
    expect(screen.getByText(/Volume:/)).toBeInTheDocument();
    expect(screen.getByText(/1250/)).toBeInTheDocument();
  });
}); 