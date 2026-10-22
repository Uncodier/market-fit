import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { LocalizationProvider, useLocalization } from '@/app/context/LocalizationContext'
import { setupFeedback } from '@/app/create-site/site-setup-feedback'
import { SiteSetupNotice } from '@/app/create-site/site-setup-notice'
import { checkSiteSetup, startSiteSetup, type SiteSetupFeedback } from '@/app/create-site/start-site-setup'

jest.mock('@/app/create-site/start-site-setup', () => ({ checkSiteSetup: jest.fn(), startSiteSetup: jest.fn() }))
const siteId = '00000000-0000-4000-8000-000000000001'
const workflowId = `site-setup-${siteId}-1791331200000`
function Harness() {
  const [feedback, setFeedback] = useState<SiteSetupFeedback>({ status: 'pending', workflowId,
    message: 'Background setup is pending; completion is not yet confirmed.' })
  return <LocalizationProvider preferredLocale="en"><SiteSetupNotice feedback={feedback} onCheck={async () => setFeedback(await checkSiteSetup(siteId, workflowId))} /></LocalizationProvider>
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

function LocaleSwitch() {
  const { setLocale } = useLocalization()
  return <button onClick={() => setLocale('es')}>Switch language</button>
}

it('updates safe setup statuses and details on language changes without network work', () => {
  const onCheck = jest.fn()
  render(<LocalizationProvider preferredLocale="en">
    <LocaleSwitch />
    <SiteSetupNotice feedback={setupFeedback('partial', workflowId, 'missing_site_url')} onCheck={onCheck} />
  </LocalizationProvider>)
  expect(screen.getByRole('status')).toHaveTextContent('background setup is partial')
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
  expect(screen.getByRole('status')).toHaveTextContent('Configuración en segundo plano: parcial')
  expect(screen.getByRole('status')).toHaveTextContent('Añade una URL del sitio web')
  expect(screen.getByRole('button', { name: 'Consultar estado de la configuración' })).toBeInTheDocument()
  expect(onCheck).not.toHaveBeenCalled()
  expect(checkSiteSetup).not.toHaveBeenCalled()
  expect(startSiteSetup).not.toHaveBeenCalled()
})