"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

import { type SiteFormValues } from "./form-schema"

import { useDropzone } from "react-dropzone"

import { Truck, ShieldCheck, RotateCcw } from "../ui/icons"

import { uploadAssetFile } from "@/app/assets/actions"
import { listCatalogCategories, listCatalogItems } from "@/app/catalog/actions"

interface ShopSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
  siteId?: string
}

const AVAILABLE_ICONS = [
  { value: "Truck", label: "Delivery Truck", icon: Truck },
  { value: "ShieldCheck", label: "Shield Check", icon: ShieldCheck },
  { value: "RotateCcw", label: "Rotate / Returns", icon: RotateCcw }
]

export function useShopSection({ active, onSave, siteId }: ShopSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [badgesList, setBadgesList] = useState<any[]>(
    form.getValues("shop.trust_badges") || []
  )
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])

  const siteUrl = form.watch("url") || (siteId ? `https://${siteId}.uncodie.com` : "https://uncodie.com")

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl)
      toast.success("URL copied to clipboard")
    } catch (err) {
      toast.error("Failed to copy URL")
    }
  }

  const handleDownloadQR = () => {
    const container = document.getElementById("marketplace-qr-code-container")
    const svg = container?.querySelector("svg")
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        if (ctx) {
          ctx.fillStyle = "white"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const pngFile = canvas.toDataURL("image/png")
          const downloadLink = document.createElement("a")
          downloadLink.download = `${siteId || "marketplace"}-qr.png`
          downloadLink.href = pngFile
          downloadLink.click()
        }
      }
      img.src = "data:image/svg+xml;base64," + btoa(svgData)
    }
  }

  useEffect(() => {
    if (siteId) {
      listCatalogCategories(siteId).then(res => {
        if (res.data) setCategories(res.data)
      })
      listCatalogItems({ siteId, pageSize: 1000 }).then(res => {
        if (res.data) setItems(res.data)
      })
    }
  }, [siteId])

  useEffect(() => {
    // Keep local state in sync if form gets reset or hydrated
    const currentBadges = form.getValues("shop.trust_badges") || []
    setBadgesList(currentBadges)
    
    const subscription = form.watch((value, { name }) => {
      if (!name || name.startsWith('shop.trust_badges')) {
        setBadgesList(value.shop?.trust_badges || [])
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving shop settings:", error)
    } finally {
      setSavingCard(null)
    }
  }

  const addBadge = () => {
    if (badgesList.length >= 3) return
    const newBadges = [...badgesList, { title: "", subtitle: "", icon: "Truck" }]
    setBadgesList(newBadges)
    form.setValue("shop.trust_badges", newBadges as any, { shouldDirty: true, shouldValidate: true })
  }

  const removeBadge = (index: number) => {
    const newBadges = badgesList.filter((_, i) => i !== index)
    setBadgesList(newBadges)
    form.setValue("shop.trust_badges", newBadges as any, { shouldDirty: true, shouldValidate: true })
  }

  const onDropImage = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      const { path, error } = await uploadAssetFile(file)
      if (error) {
        console.error("Error uploading image:", error)
        return
      }
      if (path) {
        form.setValue("shop.hero_image_url", path, { shouldDirty: true, shouldValidate: true })
      }
    } catch (error) {
      console.error("Failed to upload image:", error)
    } finally {
      setIsUploadingImage(false)
    }
  }, [form])

  const { getRootProps: getHeroRootProps, getInputProps: getHeroInputProps, isDragActive: isHeroDragActive } = useDropzone({
    onDrop: onDropImage,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"]
    },
    disabled: isUploadingImage,
    maxFiles: 1
  })

  return {
    active, onSave, siteId, form, savingCard,
    badgesList, isUploadingImage, categories, items, siteUrl,
    handleCopyUrl, handleDownloadQR, handleSave, addBadge, removeBadge,
    getHeroRootProps, getHeroInputProps, isHeroDragActive,
  }
}
