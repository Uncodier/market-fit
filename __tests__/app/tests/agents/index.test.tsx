import { fireEvent, screen, within } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { getCommands } from '@/app/agents/actions';
import { CommandsTestInterface } from './test-interfaces';
import type { Command } from '@/app/agents/types';

jest.mock('@/app/agents/actions', () => ({ getCommands: jest.fn() }));
jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: { id: 'site-1' } }),
}));

// Jest discovers the individual suites; importing them here leaks mocks and runs them twice.
describe('Agent command UI integration', () => {
  test('appends the next site-scoped page and navigates from the resulting table', async () => {
    const push = jest.fn();
    jest.mocked(useRouter).mockReturnValue({ ...useRouter(), push });
    const firstPage = CommandsTestInterface.createTestCommands(40);
    const nextCommand: Command = {
      id: 'next-page-command',
      agent_id: 'agent-2',
      task: 'Next page command',
      description: 'Fetched from the second page',
      status: 'failed',
    };

    await CommandsTestInterface.renderCommandsPanel({ initialCommands: firstPage });
    CommandsTestInterface.expectCommandsDisplayed(firstPage);
    expect(screen.getAllByRole('row')).toHaveLength(41);
    jest.mocked(getCommands).mockResolvedValueOnce({ commands: [nextCommand] });

    fireEvent.click(screen.getByRole('button', { name: 'Load More' }));
    const nextRow = (await screen.findByText('Next page command')).closest('tr')!;

    expect(jest.mocked(getCommands).mock.calls).toEqual([['site-1', 1], ['site-1', 2]]);
    CommandsTestInterface.expectCommandsDisplayed(firstPage);
    expect(screen.getAllByRole('row')).toHaveLength(42);
    expect(within(nextRow).getByText('Failed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();

    fireEvent.click(nextRow);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/agents/agent-2/next-page-command');
  });
});