import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const modules = [
  'page.tsx', 'screen-metadata.ts', 'tenant-lookup.ts', 'use-tenant-lookup.ts',
  'use-robots-controller.tsx', 'use-instance-creation.tsx', 'use-instance-actions.tsx',
  'use-browser-workspace.tsx', 'use-browser-presentation.tsx', 'use-workspace-tabs.tsx',
  'instance-header.tsx', 'instance-modals.tsx', 'robots-workspace.tsx',
]
const source = (file: string) => readFileSync(join(process.cwd(), 'app/robots', file), 'utf8')

describe('Robots page responsibility boundaries', () => {
  it.each(modules)('keeps %s below 500 lines', file => {
    expect(source(file).split('\n').length).toBeLessThan(500)
  })

  it('keeps controller hooks in their original lifecycle order', () => {
    const page = source('page.tsx')
    const calls = [
      'useRobotsController()', 'useInstanceCreation(controller)', 'useInstanceActions(creation)',
      'useBrowserWorkspace(actions)', 'useBrowserPresentation(browser)', 'useWorkspaceTabs(presentation)',
    ]
    calls.forEach((call, index) => {
      expect(page).toContain(call)
      if (index) expect(page.indexOf(calls[index - 1])).toBeLessThan(page.indexOf(call))
    })
    expect(page).toContain('<InstanceHeader {...workspace} />')
    expect(page).toContain('<InstanceModals {...workspace} />')
    expect(page).toContain('<RobotsWorkspace {...workspace} />')
  })

  it('keeps browser-only dynamic presentation in the workspace view', () => {
    expect(source('robots-workspace.tsx')).toContain('{ ssr: false }')
    for (const file of modules.filter(file => file.startsWith('use-'))) {
      expect(source(file)).not.toContain('next/dynamic')
    }
    expect(source('use-browser-presentation.tsx')).toContain('useTenantLookup({')
    expect(source('use-browser-presentation.tsx')).not.toContain('useSWR(')
  })
})