import { render, screen } from '@testing-library/react'
import { OnboardingProgressWidget } from '@/app/components/navigation/OnboardingProgressWidget'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { useSite } from '@/app/context/SiteContext'
import { readOnboardingProgress } from '@/app/lib/onboarding-completion'
import { ALL_TASK_IDS } from '@/app/lib/onboarding-task-ids'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/auth/auth-context', () => ({ useAuthContext: jest.fn() }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

function selection(raw: unknown, loading = false, actor = 'reader', siteId = 'one', target = siteId) {
  jest.mocked(useSite).mockReturnValue({ isLoading: loading,
    currentSite: { id: siteId, onboardingProgress: readOnboardingProgress(raw) }, requestScope: { actorId: actor, siteId: target },
  } as ReturnType<typeof useSite>)
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useAuthContext).mockReturnValue({ user: { id: 'reader' }, isLoading: false } as ReturnType<typeof useAuthContext>)
})

it('derives progress from the hydrated row with no additional query and responds to later settings changes', () => {
  selection(null, true)
  const view = render(<OnboardingProgressWidget />)
  expect(view.container).toBeEmptyDOMElement()
  selection(null)
  view.rerender(<OnboardingProgressWidget />)
  expect(screen.getByText('0%')).toBeVisible()
  selection({ setup_billing: true, create_workflows: 'true', unknown_task: true })
  view.rerender(<OnboardingProgressWidget />)
  expect(screen.getByText(`${Math.round(100 / ALL_TASK_IDS.length)}%`)).toBeVisible()
  selection(Object.fromEntries(ALL_TASK_IDS.map(id => [id, true])))
  view.rerender(<OnboardingProgressWidget />)
  expect(view.container).toBeEmptyDOMElement()
  expect(createClient).not.toHaveBeenCalled()
})

it('does not present missing data, a mismatched actor/site, or a demo as real workspace progress', () => {
  selection({ setup_billing: true })
  const view = render(<OnboardingProgressWidget />)
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  for (const change of [() => selection({ setup_billing: true }, false, 'other'),
    () => selection({}, false, 'reader', 'one', 'two'), () => selection({}, false, 'reader', 'demo-example'),
    () => selection(undefined), () => selection(['bad'])]) {
    change(); view.rerender(<OnboardingProgressWidget />)
    expect(view.container).toBeEmptyDOMElement()
  }
  expect(createClient).not.toHaveBeenCalled()
})