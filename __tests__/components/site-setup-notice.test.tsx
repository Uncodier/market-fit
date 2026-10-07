import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { SiteSetupNotice } from '@/app/create-site/site-setup-notice'
import { checkSiteSetup, startSiteSetup, type SiteSetupFeedback } from '@/app/create-site/start-site-setup'

jest.mock('@/app/create-site/start-site-setup', () => ({ checkSiteSetup: jest.fn(), startSiteSetup: jest.fn() }))
const siteId = '00000000-0000-4000-8000-000000000001'
const workflowId = `site-setup-${siteId}-1791331200000`
function Harness() {
  const [feedback, setFeedback] = useState<SiteSetupFeedback>({ status: 'pending', workflowId,
    message: 'Background setup is pending; completion is not yet confirmed.' })
  return <SiteSetupNotice feedback={feedback} onCheck={async () => setFeedback(await checkSiteSetup(siteId, workflowId))} />
}
beforeEach(() => jest.clearAllMocks())

it('visibly distinguishes pending and partial setup and only reads status on user request', async () => {
  jest.mocked(checkSiteSetup).mockResolvedValue({ status: 'partial', workflowId, message: 'Background setup is partial.' })
  render(<Harness />)
  expect(screen.getByRole('status')).toHaveTextContent('completion is not yet confirmed')
  expect(checkSiteSetup).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Check setup status' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Background setup is partial.'))
  expect(checkSiteSetup).toHaveBeenCalledWith(siteId, workflowId)
  expect(startSiteSetup).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
})

it('keeps a failed setup visible without replaying it', async () => {
  jest.mocked(checkSiteSetup).mockResolvedValue({ status: 'failed', workflowId, message: 'Background setup failed.' })
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Check setup status' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Background setup failed.'))
  expect(startSiteSetup).not.toHaveBeenCalled()
})