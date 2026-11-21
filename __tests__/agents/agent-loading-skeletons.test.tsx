import { render, screen } from "@testing-library/react"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import DirectoryLoading from "@/app/agents/loading"
import ProfileLoading from "@/app/agents/[id]/loading"
import DraftLoading from "@/app/agents/new/loading"
import { ContextFilesSkeleton } from "@/app/agents/agent-detail-skeletons"
import { AgentChannelsSkeleton } from "@/app/components/agents/channel-skeletons"

it.each([
  ['directory', DirectoryLoading], ['profile', ProfileLoading],
  ['new agent', DraftLoading], ['channels', AgentChannelsSkeleton], ['files', ContextFilesSkeleton],
] as const)('renders an inert, localized skeleton for %s', (_name, Content) => {
  render(<LocalizationProvider preferredLocale="es"><Content /></LocalizationProvider>)
  const region = screen.getByRole('status', { name: 'Cargando...' })
  expect(region).toHaveAttribute('aria-busy', 'true')
  expect(region.querySelector('input, select, textarea, button, a, [tabindex]')).toBeNull()
  expect(region).toHaveTextContent(/^$/)
  const shapes = region.querySelectorAll('.animate-pulse')
  expect(shapes.length).toBeGreaterThan(5)
  shapes.forEach(shape => expect(shape.closest('[aria-hidden="true"]')).not.toBeNull())
  expect(region.className).toContain('motion-reduce:')
})