# Licensing boundaries and release review

## Current policy

Read [the root notice](../LICENSE.md) and the
[Makinari Internal-Use Source-Available License 1.0](../licenses/MAKINARI-INTERNAL-USE-1.0.md).
The [scope manifest](../licenses/procurement-scope.json) identifies the covered code,
tests, designs and migrations. These modules are **not open source**.

| Activity | Under this license |
| --- | --- |
| Read and evaluate covered code | Permitted |
| Modify and run it internally, including production at a commercial business | Permitted |
| Use contractors or hosting providers solely for that deployment | Permitted under section 3 safeguards |
| Invite suppliers to respond to the licensee's own tenders | Permitted; not an independent workspace/service for those suppliers |
| Export business records or data | Permitted, unless the export includes covered software |
| Offer it as SaaS or white-label software for other entities | Separate commercial license required, including free offerings |
| Redistribute source, compiled code, containers, public forks or modified versions | Separate commercial license required, except narrow operational/browser delivery |

The counterparties exception is essential to the procurement workflow: internal use
does not mean suppliers cannot submit proposals to the deploying organization's own
tenders. It does not permit selling or hosting procurement software for those suppliers.

## File boundary

Directory entries cover their descendants; file entries are exact paths. Exclusions
take precedence. Add future procurement migrations and out-of-directory feature files
explicitly to the manifest. Moving a covered work does not remove its legal coverage;
update the manifest so the notice remains discoverable.

Do not blanket-license `app/purchases/` or `app/home/`: they also contain pre-existing
commerce views, aliases and shared integration wrappers. The new feature implementations
are covered, while shared UI, BuyerShell, legacy checkout, routing infrastructure and
their existing ownership/licenses are not relicensed by this notice. Importing a
covered module does not relicense its importing file, nor grant distribution rights
to the combined bundle. Distributing an application containing covered modules still
requires appropriate permission for those modules.

No root MIT, Apache, AGPL or other open-source license was present in this branch when
this policy was added. The root notice therefore does not label the remainder open
source. Establish its actual license separately before advertising an open-source
edition. Dependency and third-party licensing obligations remain independent.

## Before public release

This custom text records the requested product policy. Qualified legal review is
required before relying on it as a production licensing program. In particular:

- Verify the actual legal rights holder, authorized signatory and commercial contact;
  no corporate identity, address, governing law or venue has been invented here.
- Verify ownership and contributor agreements for every covered file and any copied
  or adapted portions. A path manifest cannot override incompatible existing rights.
- Determine the base license for the rest of the repository; until then there is no
  established open-source core license in this branch.
- Preserve rights already granted for earlier copies/releases. Merely removing a
  component from a future open-source edition does not revoke an earlier license.
- Confirm operational contractors, browser delivery, supplier participation, affiliate
  boundaries, termination and liability terms with counsel.
- Review distribution artifacts: browser bundles, container images and package exports
  can contain covered code even if the original directory names are absent.
- Do not represent these terms as OSI-approved, and do not describe this change as a
  third-party sublicense unless the relevant rights actually permit sublicensing.

There is no automatic future conversion to an open-source license, no assignment of
contributor copyright, and no migration/deployment or runtime license enforcement
introduced by this documentation change.