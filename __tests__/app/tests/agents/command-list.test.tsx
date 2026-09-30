import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandList } from '@/app/components/agents/command-list';
import { Command } from '@/app/agents/types';

describe('CommandList', () => {
  test('renders empty state when no commands are provided', () => {
    render(<CommandList commands={[]} />);
    
    expect(screen.getByText('No commands found')).toBeInTheDocument();
    expect(screen.getByText('Run a new command to get started')).toBeInTheDocument();
  });

  test('renders commands correctly', () => {
    const mockCommands: Command[] = [
      {
        id: 'cmd-1',
        task: 'First Task',
        description: 'This is the first task',
        status: 'completed',
        created_at: '2023-01-01T12:00:00Z',
        duration: 1500,
      },
      {
        id: 'cmd-2',
        task: 'Second Task',
        description: 'This is the second task',
        status: 'running',
        created_at: '2023-01-01T12:30:00Z',
      },
      {
        id: 'cmd-3',
        task: 'Failed Task',
        description: 'This is a failed task',
        status: 'failed',
        context: 'Error: Something went wrong',
        created_at: '2023-01-01T13:00:00Z',
      }
    ];
    
    render(<CommandList commands={mockCommands} />);
    
    // Verify all task names are displayed
    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
    expect(screen.getByText('Failed Task')).toBeInTheDocument();
    
    // Verify descriptions are displayed
    expect(screen.getByText('This is the first task')).toBeInTheDocument();
    expect(screen.getByText('This is the second task')).toBeInTheDocument();
    expect(screen.getByText('This is a failed task')).toBeInTheDocument();
  });

  test('shows error notification when hasError is true', () => {
    const mockCommands: Command[] = [
      {
        id: 'cmd-1',
        task: 'First Task',
        description: 'This is the first task',
        status: 'completed',
        created_at: '2023-01-01T12:00:00Z',
      }
    ];
    
    render(<CommandList commands={mockCommands} hasError={true} />);
    
    // Verify error message is displayed
    expect(screen.getByText('Using cached data. Connection to server failed.')).toBeInTheDocument();
  });

  test('handles invalid or malformed commands gracefully', () => {
    // Create an array with some null/undefined values and malformed data
    const mixedCommands = [
      null,
      undefined,
      {
        id: 'valid-cmd',
        task: 'Valid Command',
        description: 'This is valid',
        status: 'completed',
        created_at: '2023-01-01T12:00:00Z',
      },
      // Malformed command missing required fields
      {
        description: 'Malformed command',
      },
      {
        id: 'invalid-status',
        task: 'Invalid Status',
        description: 'Has invalid status',
        status: 'not-a-real-status',
        created_at: '2023-01-01T12:00:00Z',
      }
    ] as unknown as Command[];
    
    render(<CommandList commands={mixedCommands} />);
    
    // Verify the valid command is displayed
    expect(screen.getByText('Valid Command')).toBeInTheDocument();
    
    expect(screen.getByText('Unnamed Command')).toBeInTheDocument();
    expect(screen.getByText('Malformed command')).toBeInTheDocument();
    const invalidStatusItem = screen.getByText('Invalid Status').closest('h4')!.parentElement!;
    expect(within(invalidStatusItem).getByText('Pending')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(3);
  });

  test('renders the empty state when every command is missing', () => {
    render(<CommandList commands={[null, undefined] as unknown as Command[]} />);

    expect(screen.getByText('No commands found')).toBeInTheDocument();
    expect(screen.getByText('Run a new command to get started')).toBeInTheDocument();
  });

  test.each([null, undefined])('renders the empty state for a %s command collection', commands => {
    render(<CommandList commands={commands as unknown as Command[]} />);

    expect(screen.getByText('No commands found')).toBeInTheDocument();
  });

  test('renders every supplied command without a separate display cap', () => {
    const manyCommands: Command[] = Array(30).fill(null).map((_, i) => ({
      id: `cmd-${i}`,
      task: `Task ${i}`,
      description: `Description ${i}`,
      status: 'completed',
      created_at: new Date().toISOString(),
    }));
    
    render(<CommandList commands={manyCommands} />);
    
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(30);
    manyCommands.forEach(command => {
      expect(screen.getByRole('heading', { name: command.task })).toBeInTheDocument();
    });
  });

  test('preserves command order and navigation after ignoring missing entries', () => {
    const onNavigateToCommand = jest.fn();
    const commands: Command[] = [
      { id: 'first', task: 'First command', status: 'completed' },
      { id: 'second', task: 'Second command', status: 'failed' },
    ];
    const input = [null, commands[0], undefined, commands[1]] as unknown as Command[];

    render(<CommandList commands={input} onNavigateToCommand={onNavigateToCommand} />);

    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'First command', 'Second command',
    ]);
    fireEvent.click(screen.getByText('Second command'));
    expect(onNavigateToCommand).toHaveBeenCalledTimes(1);
    expect(onNavigateToCommand).toHaveBeenCalledWith('second');
    expect(input).toEqual([null, commands[0], undefined, commands[1]]);
  });
}); 