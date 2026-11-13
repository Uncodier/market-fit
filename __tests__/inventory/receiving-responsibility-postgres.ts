import { readFileSync } from "node:fs"
import path from "node:path"
import { bootstrap, ids, uuid } from "./movements-postgres"

const sql = (filename: string) => readFileSync(path.join(process.cwd(),
  "supabase/migrations", filename), "utf8")
export const coordination = sql("20261113190000_inventory_writer_coordination.sql")
export const receiving = sql("20261113200000_inventory_receiving_responsibility.sql")
export const receivers = {
  member: uuid(200), pending: uuid(201), suspended: uuid(202), disabled: uuid(203),
  foreign: uuid(204), memberRow: uuid(210),
}

// Extend only this suite's bootstrap: the original movement fixture remains intact.
// These are the columns consumed by the real receiver helper, not a helper mock.
export const receivingBootstrap = `${bootstrap}
  ALTER TABLE public.sites ADD COLUMN archived_at timestamptz;
  CREATE TABLE public.profiles(id uuid PRIMARY KEY, name text);
  CREATE TABLE public.site_members(
    id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites, user_id uuid,
    role text NOT NULL CHECK(role IN ('owner','admin','collaborator','marketing')),
    status text DEFAULT 'pending', name text, email text,
    license_suspended boolean NOT NULL DEFAULT false,
    manually_disabled boolean NOT NULL DEFAULT false,
    CHECK(NOT manually_disabled OR license_suspended), UNIQUE(site_id,id)
  );
  CREATE UNIQUE INDEX receiving_test_locations_site_id ON public.locations(site_id,id);
  CREATE TABLE public.site_member_location_restrictions(
    site_id uuid NOT NULL, site_member_id uuid NOT NULL, location_id uuid NOT NULL,
    PRIMARY KEY(site_id,site_member_id,location_id),
    FOREIGN KEY(site_id,site_member_id) REFERENCES public.site_members(site_id,id),
    FOREIGN KEY(site_id,location_id) REFERENCES public.locations(site_id,id)
  );
  INSERT INTO public.profiles VALUES ('${ids.owner}','  Owner name  ');
  INSERT INTO public.site_members(id,site_id,user_id,role,status,name,email,license_suspended,manually_disabled) VALUES
    ('${receivers.memberRow}','${ids.site}','${receivers.member}','collaborator','active','  Receiver name  ','member@example.test',false,false),
    ('${uuid(211)}','${ids.site}','${receivers.pending}','collaborator','pending','Pending','pending@example.test',false,false),
    ('${uuid(212)}','${ids.site}','${receivers.suspended}','collaborator','active','Suspended','suspended@example.test',true,false),
    ('${uuid(213)}','${ids.site}','${receivers.disabled}','collaborator','active','Disabled','disabled@example.test',true,true),
    ('${uuid(214)}','${ids.otherSite}','${receivers.foreign}','collaborator','active','Foreign','foreign@example.test',false,false);
`