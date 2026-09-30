import { screen, within } from '@testing-library/react';
import { CommandsTestInterface } from './test-interfaces';
import { getCommands } from '@/app/agents/actions';

// Mock the agent actions
jest.mock('@/app/agents/actions', () => ({
  getCommands: jest.fn(),
}));

// Site initialization is outside these component tests; requests still need a site.
jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: { id: 'site-1' } }),
}));

describe('CommandsTestInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('renderCommandsPanel', () => {
    it('renders commands panel with test commands', async () => {
      // Create test commands
      const testCommands = CommandsTestInterface.createTestCommands(5, { 
        completed: 0.6, 
        running: 0.2, 
        failed: 0.2 
      });
      
      // Render with test commands
      await CommandsTestInterface.renderCommandsPanel({
        initialCommands: testCommands,
      });
      
      // Verify commands are displayed
      CommandsTestInterface.expectCommandsDisplayed(testCommands);
      expect(getCommands).toHaveBeenCalledWith('site-1', 1);
    });
    
    it('handles error state correctly', async () => {
      await CommandsTestInterface.renderCommandsPanel({
        mockErrors: true,
      });
      
      expect(screen.getByText('No commands found')).toBeInTheDocument();
      expect(screen.getByText('Error: Mock error')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
    
    it('displays all statuses together without legacy filter tabs', async () => {
      // Create test commands with different statuses
      const testCommands = [
        ...CommandsTestInterface.createTestCommands(3, { completed: 1, running: 0, failed: 0 }),
        ...CommandsTestInterface.createTestCommands(2, { completed: 0, running: 1, failed: 0 }),
        ...CommandsTestInterface.createTestCommands(1, { completed: 0, running: 0, failed: 1 }),
      ];
      
      await CommandsTestInterface.renderCommandsPanel({
        initialCommands: testCommands,
      });

      CommandsTestInterface.expectCommandsDisplayed(testCommands);
      expect(screen.getAllByRole('row')).toHaveLength(testCommands.length + 1);
      testCommands.forEach(cmd => {
        const row = screen.getByText(cmd.task).closest('tr')!;
        expect(within(row).getByText(new RegExp(`^${cmd.status}$`, 'i'))).toBeInTheDocument();
      });
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });
  
  describe('renderCommandList', () => {
    it('renders command list directly', () => {
      const testCommands = CommandsTestInterface.createTestCommands(3);
      
      CommandsTestInterface.renderCommandList(testCommands);
      
      CommandsTestInterface.expectCommandsDisplayed(testCommands);
    });
    
    it('displays the connection warning alongside cached commands', () => {
      const commands = CommandsTestInterface.createTestCommands(1);
      CommandsTestInterface.renderCommandList(commands, true);
      
      CommandsTestInterface.expectCommandsDisplayed(commands);
      expect(screen.getByText('Using cached data. Connection to server failed.')).toBeInTheDocument();
    });

    it('displays the empty state when there are no cached commands', () => {
      CommandsTestInterface.renderCommandList([], true);

      expect(screen.getByText('No commands found')).toBeInTheDocument();
      expect(screen.queryByText('Using cached data. Connection to server failed.')).not.toBeInTheDocument();
    });
  });
  
  describe('createTestCommands', () => {
    it('creates commands with specified distribution', () => {
      const commands = CommandsTestInterface.createTestCommands(100, {
        completed: 0.3,
        running: 0.6,
        failed: 0.1
      });
      
      const completedCount = commands.filter(cmd => cmd.status === 'completed').length;
      const runningCount = commands.filter(cmd => cmd.status === 'running').length;
      const failedCount = commands.filter(cmd => cmd.status === 'failed').length;
      
      expect(completedCount).toBe(30);
      expect(runningCount).toBe(60);
      expect(failedCount).toBe(10);
      expect(new Set(commands.map(command => command.id)).size).toBe(100);
    });
  });
}); 