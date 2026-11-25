/** @jest-environment node */
import { isolatedPostgres, migration, postgresAvailable } from '../security/isolated-postgres'
import { accessSql, id, installConnectorFixture } from './connector-postgres-fixture'

;(postgresAvailable ? describe : describe.skip)('workflow task draft connector references', () => {
  const pg = isolatedPostgres()
  beforeAll(() => {
    pg.start()
    installConnectorFixture(pg.db)
    pg.db(`CREATE TABLE public.instance_nodes(type text, site_id uuid, instance_id uuid);
      INSERT INTO public.instance_nodes VALUES ('wf-step','${id.site}',gen_random_uuid());
      GRANT SELECT, UPDATE ON public.instance_nodes TO authenticated;`)
    pg.db(migration('20261125210000_workflow_task_connector_reference.sql'))
    pg.call(accessSql([{ user_id: id.member, can_view: true, can_use: false }]), id.owner, 'service_role')
  }, 30000)
  afterAll(() => pg.stop())
  const set = (connector: string | null) => pg.call(`UPDATE instance_nodes SET task_connector_id =
    ${connector ? `'${connector}'` : 'NULL'} RETURNING task_connector_id`, id.member)

  it('can propose a view-only account, cannot substitute hidden or foreign accounts or move the binding', () => {
    expect(set(id.connector)).toBe(id.connector)
    for (const connector of [id.hidden, id.foreignConnector]) expect(() => set(connector)).toThrow(/not available/)
    expect(() => pg.call(`UPDATE instance_nodes SET site_id='${id.otherSite}'`, id.member)).toThrow(/not available/)
    expect(() => pg.call("UPDATE instance_nodes SET type='wf-trigger'", id.member)).toThrow(/not available/)
    expect(pg.call(`SELECT can_use FROM connector_members WHERE connector_id='${id.connector}'`, id.member)).toBe('f')
    expect(set(null)).toBe('')
  })
})