/** @jest-environment node */
import path from 'node:path'
import ts from 'typescript'

it('compiles only the real reorder RPC arguments and the void result contract', () => {
  // Jest's SWC transform does not typecheck. Invoke the installed TS compiler on
  // a virtual consumer so ignored @ts-expect-error directives fail this test.
  const filename = path.join(process.cwd(), '__tests__/control-center/reorder-consumer.ts')
  const source = `
    import type { Database } from '../../types/supabase'
    import type { SupabaseClient } from '@supabase/supabase-js'
    type Reorder = Database['public']['Functions']['reorder_task_priorities']
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
      (<T>() => T extends B ? 1 : 2) ? true : false
    const exactArgs: Equal<Reorder['Args'], {
      p_task_id: string; p_new_position: number; p_status: string; p_site_id: string
    }> = true
    const exactReturn: Equal<Reorder['Returns'], undefined> = true
    const valid: Reorder['Args'] = {
      p_task_id: 'task', p_new_position: 1, p_status: 'pending', p_site_id: 'site'
    }
    declare const client: SupabaseClient<Database>
    const response = client.rpc('reorder_task_priorities', valid)
    type Data = Awaited<typeof response>['data']
    const rpcReturn: Equal<Data, undefined | null> = true
    // @ts-expect-error The old name must not be accepted.
    const legacy: Reorder['Args'] = { p_task_id: 'task', p_new_priority: 1, p_status: 'pending', p_site_id: 'site' }
    // @ts-expect-error Position is mandatory, not optional.
    client.rpc('reorder_task_priorities', { p_task_id: 'task', p_status: 'pending', p_site_id: 'site' })
    // @ts-expect-error RPC position is numeric.
    client.rpc('reorder_task_priorities', { ...valid, p_new_position: '1' })
    // @ts-expect-error Void functions cannot return a JSON object.
    const jsonResult: Reorder['Returns'] = { success: true }
    // @ts-expect-error A nullable argument is not part of the application contract.
    const nullPosition: Reorder['Args'] = { ...valid, p_new_position: null }
  `
  const options: ts.CompilerOptions = {
    strict: true, noEmit: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: process.cwd(), paths: { '@/*': ['./*'] },
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => file === filename
    ? ts.createSourceFile(filename, source, languageVersion, true)
    : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile)
  const program = ts.createProgram([filename], options, host)
  const errors = ts.getPreEmitDiagnostics(program).map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  expect(errors).toEqual([])
}, 20000)