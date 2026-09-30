import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandItem, Command } from '@/app/components/agents/command-item';
import { useRouter } from 'next/navigation';

describe('CommandItem', () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useRouter).mockReturnValue({ ...useRouter(), push });
  });

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

  test.each([
    ['agent-1', '/agents/agent-1/test-cmd-1'],
    [undefined, '/agents/default/test-cmd-1'],
  ])('navigates to command details with agent ID %s', (agentId, expectedRoute) => {
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
    
    render(<CommandItem command={commandWithDetails} agentId={agentId} />);

    fireEvent.click(screen.getByText('Test Command'));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(expectedRoute);
    expect(screen.queryByText('General Information')).not.toBeInTheDocument();
    expect(screen.queryByText('claude-3')).not.toBeInTheDocument();
  });

  test('uses the supplied navigation callback instead of the router', () => {
    const onNavigate = jest.fn();
    render(<CommandItem command={baseCommand} agentId="agent-1" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText('Test Command'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
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
    
    // JSON error messages remain readable in the summary.
    expect(screen.getByText(/API_ERROR/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to connect to API/)).toBeInTheDocument();
  });

  test('keeps complex results out of the summary and navigates to their detail page', () => {
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
    
    render(<CommandItem command={complexResultsCommand} agentId="agent-1" />);

    fireEvent.click(screen.getByText('Test Command'));

    expect(push).toHaveBeenCalledWith('/agents/agent-1/test-cmd-1');
    expect(screen.getByText('This is a test command')).toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
    expect(screen.queryByText('Main Topic')).not.toBeInTheDocument();
  });
}); 