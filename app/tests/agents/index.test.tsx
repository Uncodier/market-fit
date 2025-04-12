/**
 * Agent Components Test Interface
 * 
 * This file serves as an entry point for all agent component tests.
 * It helps organize and manage the test suite for agent-related UI components.
 */

// Import test suites for agent components
import './commands-panel.test';
import './command-list.test';
import './command-item.test';
import './commands-table.test';
import './command-sanity.test';
import './failed-tab.test';

describe('Agent Components', () => {
  test('Test suite loaded successfully', () => {
    // This test simply confirms that the test suite loaded properly
    expect(true).toBe(true);
  });
}); 