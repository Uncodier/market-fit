import {
  capabilitiesFromRole,
  parseCapabilities,
} from "@/lib/permissions/capabilities"
import { inferButtonCommand, getNodeText } from "@/lib/permissions/button-heuristic"
import {
  isRlsError,
  mapPermissionError,
  permissionDeniedMessage,
} from "@/lib/permissions/error-map"

describe("capabilitiesFromRole", () => {
  it("gives owners full access", () => {
    expect(capabilitiesFromRole("owner")).toEqual({
      role: "owner",
      is_owner: true,
      select: true,
      insert: true,
      update: true,
      delete: true,
    })
  })

  it("lets admin and collaborator write but not delete", () => {
    for (const role of ["admin", "collaborator"] as const) {
      expect(capabilitiesFromRole(role)).toEqual({
        role,
        is_owner: false,
        select: true,
        insert: true,
        update: true,
        delete: false,
      })
    }
  })

  it("limits marketing to select", () => {
    expect(capabilitiesFromRole("marketing")).toEqual({
      role: "marketing",
      is_owner: false,
      select: true,
      insert: false,
      update: false,
      delete: false,
    })
  })

  it("denies everything when role is missing", () => {
    expect(capabilitiesFromRole(null).select).toBe(false)
    expect(capabilitiesFromRole(null).insert).toBe(false)
  })
})

describe("parseCapabilities", () => {
  it("reads RPC json", () => {
    expect(
      parseCapabilities({
        role: "marketing",
        is_owner: false,
        select: true,
        insert: false,
        update: false,
        delete: false,
      })
    ).toMatchObject({ role: "marketing", insert: false, update: false })
  })

  it("returns null for invalid payloads", () => {
    expect(parseCapabilities(null)).toBeNull()
    expect(parseCapabilities("nope")).toBeNull()
  })
})

describe("inferButtonCommand", () => {
  it("treats submit and Save as update", () => {
    expect(inferButtonCommand({ type: "submit", variant: "outline" })).toBe("update")
    expect(inferButtonCommand({ childrenText: "Save changes", variant: "outline" })).toBe(
      "update"
    )
  })

  it("treats primary CTAs and Create/Add as insert", () => {
    expect(inferButtonCommand({ variant: "default", childrenText: "Add Lead" })).toBe("insert")
    expect(inferButtonCommand({ childrenText: "Create Agent" })).toBe("insert")
    expect(inferButtonCommand({ variant: "default", childrenText: "OK" })).toBe("insert")
  })

  it("treats destructive and Delete as delete", () => {
    expect(inferButtonCommand({ variant: "destructive", childrenText: "Remove" })).toBe(
      "delete"
    )
    expect(inferButtonCommand({ childrenText: "Delete lead", variant: "outline" })).toBe(
      "delete"
    )
  })

  it("skips navigation, filters, and data-permission=allow", () => {
    expect(inferButtonCommand({ variant: "ghost", childrenText: "Save" })).toBeNull()
    expect(inferButtonCommand({ variant: "default", childrenText: "Download" })).toBeNull()
    expect(inferButtonCommand({ variant: "default", childrenText: "Filter" })).toBeNull()
    expect(
      inferButtonCommand({
        variant: "default",
        childrenText: "Save",
        dataPermission: "allow",
      })
    ).toBeNull()
  })
})

describe("getNodeText", () => {
  it("flattens nested children", () => {
    expect(getNodeText(["Add", " ", "Lead"])).toBe("Add   Lead")
    expect(getNodeText({ props: { children: "Save" } })).toBe("Save")
  })
})

describe("RLS error mapping", () => {
  it("detects postgres and postgrest permission codes", () => {
    expect(isRlsError({ code: "42501", message: "x" })).toBe(true)
    expect(isRlsError({ code: "PGRST301", message: "x" })).toBe(true)
    expect(isRlsError({ message: "new row violates row-level security policy" })).toBe(true)
    expect(isRlsError({ code: "23505", message: "duplicate" })).toBe(false)
  })

  it("rewrites the message per command", () => {
    expect(permissionDeniedMessage("insert")).toBe(
      "You don't have permission to create this."
    )
    expect(permissionDeniedMessage("update")).toBe(
      "You don't have permission to save changes."
    )
    expect(permissionDeniedMessage("delete")).toBe(
      "You don't have permission to delete this."
    )
    expect(
      mapPermissionError({ code: "42501", message: "permission denied for table leads" }).message
    ).toBe("You don't have permission to save changes.")
  })
})
