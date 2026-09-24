"use client"

import { type Dispatch, type SetStateAction, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { SiteOnboardingValues } from "../schemas/onboarding-schema"

type Location = SiteOnboardingValues["locations"][number]
type RestrictionAddress = NonNullable<
  NonNullable<Location["restrictions"]>["included_addresses"]
>[number]

const createLocation = (): Location => ({
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  restrictions: {
    enabled: false,
    included_addresses: [],
    excluded_addresses: [],
  },
})

const createAddress = () => ({
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
})

const createOffer = () => ({
  name: "",
  description: "",
  cost: 0,
  lowest_sale_price: 0,
  target_sale_price: 0,
})

export function useOnboardingCollections(
  form: UseFormReturn<SiteOnboardingValues>
) {
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())

  const addLocation = () => {
    form.setValue("locations", [...(form.getValues("locations") || []), createLocation()])
  }

  const removeLocation = (index: number) => {
    const locations = form.getValues("locations") || []
    form.setValue("locations", locations.filter((_, itemIndex) => itemIndex !== index))
  }

  const updateRestrictionAddresses = (
    locationIndex: number,
    addressType: "included_addresses" | "excluded_addresses",
    update: (addresses: RestrictionAddress[]) => RestrictionAddress[]
  ) => {
    const locations = [...(form.getValues("locations") || [])]
    const location = locations[locationIndex]
    if (!location) return

    const restrictions = location.restrictions || {
      enabled: false,
      included_addresses: [],
      excluded_addresses: [],
    }

    locations[locationIndex] = {
      ...location,
      restrictions: {
        ...restrictions,
        enabled: true,
        [addressType]: update([...(restrictions[addressType] || [])]),
      },
    }
    form.setValue("locations", locations)
  }

  const addIncludedAddress = (locationIndex: number) => {
    updateRestrictionAddresses(locationIndex, "included_addresses", (addresses) => [
      ...addresses,
      createAddress(),
    ])
  }

  const addExcludedAddress = (locationIndex: number) => {
    updateRestrictionAddresses(locationIndex, "excluded_addresses", (addresses) => [
      ...addresses,
      createAddress(),
    ])
  }

  const removeIncludedAddress = (locationIndex: number, addressIndex: number) => {
    updateRestrictionAddresses(locationIndex, "included_addresses", (addresses) =>
      addresses.filter((_, itemIndex) => itemIndex !== addressIndex)
    )
  }

  const removeExcludedAddress = (locationIndex: number, addressIndex: number) => {
    updateRestrictionAddresses(locationIndex, "excluded_addresses", (addresses) =>
      addresses.filter((_, itemIndex) => itemIndex !== addressIndex)
    )
  }

  const updateAddress = (
    locationIndex: number,
    addressIndex: number,
    addressType: "included_addresses" | "excluded_addresses",
    field: string,
    value: string
  ) => {
    updateRestrictionAddresses(locationIndex, addressType, (addresses) => {
      if (!addresses[addressIndex]) return addresses
      addresses[addressIndex] = { ...addresses[addressIndex], [field]: value }
      return addresses
    })
  }

  const handleIncludedAddressUpdate = (
    locationIndex: number,
    addressIndex: number,
    field: string,
    value: string
  ) => updateAddress(locationIndex, addressIndex, "included_addresses", field, value)

  const handleExcludedAddressUpdate = (
    locationIndex: number,
    addressIndex: number,
    field: string,
    value: string
  ) => updateAddress(locationIndex, addressIndex, "excluded_addresses", field, value)

  const addMarketingChannel = () => {
    const channels = form.getValues("marketing_channels") || []
    form.setValue("marketing_channels", [...channels, { name: "" }])
  }

  const removeMarketingChannel = (index: number) => {
    const channels = form.getValues("marketing_channels") || []
    form.setValue(
      "marketing_channels",
      channels.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  const addProduct = () => {
    const products = form.getValues("products") || []
    form.setValue("products", [...products, createOffer()])
    setExpandedProducts((expanded) => new Set(expanded).add(products.length))
  }

  const removeProduct = (index: number) => {
    const products = form.getValues("products") || []
    form.setValue("products", products.filter((_, itemIndex) => itemIndex !== index))
  }

  const addService = () => {
    const services = form.getValues("services") || []
    form.setValue("services", [...services, createOffer()])
    setExpandedServices((expanded) => new Set(expanded).add(services.length))
  }

  const removeService = (index: number) => {
    const services = form.getValues("services") || []
    form.setValue("services", services.filter((_, itemIndex) => itemIndex !== index))
  }

  const toggleExpanded = (
    index: number,
    setExpanded: Dispatch<SetStateAction<Set<number>>>
  ) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return {
    expandedProducts,
    expandedServices,
    addLocation,
    removeLocation,
    addIncludedAddress,
    addExcludedAddress,
    removeIncludedAddress,
    removeExcludedAddress,
    handleIncludedAddressUpdate,
    handleExcludedAddressUpdate,
    addMarketingChannel,
    removeMarketingChannel,
    addProduct,
    removeProduct,
    addService,
    removeService,
    toggleProductExpanded: (index: number) =>
      toggleExpanded(index, setExpandedProducts),
    toggleServiceExpanded: (index: number) =>
      toggleExpanded(index, setExpandedServices),
  }
}

export type OnboardingCollections = ReturnType<typeof useOnboardingCollections>
