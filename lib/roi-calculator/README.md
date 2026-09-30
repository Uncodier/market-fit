# Retired ROI Calculator Prototype

The unused calculator prototype was retired during the September 2026 static
analysis repair. Its calculator engine was empty, its legacy hook referenced
removed application modules, and no application or test imported the subsystem.

The retirement does not remove the live reporting or analytics endpoints under
`app/api/roi`, `app/api/cac`, `app/api/cpl`, or `app/api/ltv`. Those routes retain
their own implementations and authorization boundaries.

Do not restore the prototype by adding placeholder calculations or mock server
actions. A future interactive calculator needs an explicit product contract,
tested calculations, and authenticated persistence before it can be introduced.
