import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { CommandsTestInterface } from './test-interfaces';
import { getCommands } from '@/app/agents/actions';

// Mock the agent actions
jest.mock('@/app/agents/actions', () => ({
  getCommands: jest.fn(),
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
    });
    
    it('handles error state correctly', async () => {
      await CommandsTestInterface.renderCommandsPanel({
        mockErrors: true,
      });
      
      expect(screen.getByText(/unable to load commands/i)).toBeInTheDocument();
    });
    
    it('filters commands by status', async () => {
      // Create test commands with different statuses
      const testCommands = [
        ...CommandsTestInterface.createTestCommands(3, { completed: 1, running: 0, failed: 0 }),
        ...CommandsTestInterface.createTestCommands(2, { completed: 0, running: 1, failed: 0 }),
        ...CommandsTestInterface.createTestCommands(1, { completed: 0, running: 0, failed: 1 }),
      ];
      
      // Render with failed tab selected
      await CommandsTestInterface.renderCommandsPanel({
        initialCommands: testCommands,
        filterStatus: 'failed'
      });
      
      // Only failed commands should be displayed
      const failedCommands = testCommands.filter(cmd => cmd.status === 'failed');
      CommandsTestInterface.expectCommandsDisplayed(failedCommands);
      
      // Completed commands should not be displayed
      const completedCommands = testCommands.filter(cmd => cmd.status === 'completed');
      completedCommands.forEach(cmd => {
        expect(screen.queryByText(cmd.task)).not.toBeInTheDocument();
      });
    });
  });
  
  describe('renderCommandList', () => {
    it('renders command list directly', () => {
      const testCommands = CommandsTestInterface.createTestCommands(3);
      
      CommandsTestInterface.renderCommandList(testCommands);
      
      CommandsTestInterface.expectCommandsDisplayed(testCommands);
    });
    
    it('displays error notification when hasError is true', () => {
      CommandsTestInterface.renderCommandList([], true);
      
      expect(screen.getByText(/connection issue/i)).toBeInTheDocument();
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
      
      // Allow some variation due to randomness
      expect(completedCount).toBeGreaterThanOrEqual(20);
      expect(completedCount).toBeLessThanOrEqual(40);
      expect(runningCount).toBeGreaterThanOrEqual(50);
      expect(runningCount).toBeLessThanOrEqual(70);
      expect(failedCount).toBeGreaterThanOrEqual(5);
      expect(failedCount).toBeLessThanOrEqual(20);
    });
  });
}); 