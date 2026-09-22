"use client"

import type { UseFormReturn } from "react-hook-form"
import type { SiteFormValues } from "./form-schema"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form"
import { Input } from "../ui/input"
import {
  SectionCard,
  SectionCardContent,
  SectionCardFooter,
  SectionCardHeader,
  SectionCardTitle,
} from "../ui/section-card"
import { Button } from "../ui/button"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { ChevronDown, Trash2 } from "../ui/icons"
import { BlueskyConnectForm } from "./BlueskyConnectForm"
import {
  COUNTRY_CODES,
  getPlatformFields,
  getPlatformIcon,
  isOAuthConnectablePlatform,
  NEW_ACCOUNT_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORMS,
} from "./social-section-config"

type SocialMediaEntry = NonNullable<SiteFormValues["social_media"]>[number]

interface SocialAccountCardProps {
  canConnectAccount: boolean
  form: UseFormReturn<SiteFormValues>
  imageError: boolean
  index: number
  isSaving: boolean
  onConnect: (index: number) => void
  onConnected: () => void
  onImageError: (index: number) => void
  onOpenAccountLimit: () => void
  onRequestDelete: (index: number) => void
  onSave: (index: number) => void
  siteId?: string
  social: SocialMediaEntry
}

export function SocialAccountCard({
  canConnectAccount,
  form,
  imageError,
  index,
  isSaving,
  onConnect,
  onConnected,
  onImageError,
  onOpenAccountLimit,
  onRequestDelete,
  onSave,
  siteId,
  social,
}: SocialAccountCardProps) {
  const isActive = social.isActive === true || social.isActive === 1
  const hasPlatform = !!social.platform
  const platformLabel =
    SOCIAL_PLATFORMS.find((platform) => platform.value === social.platform)?.label ||
    social.platform ||
    "New Network"
  const platformFields = getPlatformFields(social.platform)

  return (
    <SectionCard id={`social-network-${index}`}>
      <SectionCardHeader>
        <div className="flex items-center justify-between">
          <SectionCardTitle className="flex items-center gap-2">
            {getPlatformIcon(social.platform, 20)}
            {platformLabel}
          </SectionCardTitle>

          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => onRequestDelete(index)}
            className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Remove Network"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </SectionCardHeader>

      <SectionCardContent className="space-y-4">
        {!hasPlatform && (
          <FormField
            control={form.control}
            name={`social_media.${index}.platform`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Platform</FormLabel>
                <Popover>
                  <FormControl>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex h-12 w-full min-w-0 font-inter items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left overflow-hidden font-normal"
                      >
                        {field.value ? (
                          (() => {
                            const selectedItem = SOCIAL_PLATFORMS.find(
                              (platform) => platform.value === field.value
                            )
                            const Icon = selectedItem?.icon

                            return (
                              <div className="flex items-center gap-2 overflow-hidden">
                                {Icon && <Icon size={16} className="flex-shrink-0" />}
                                <span className="truncate">
                                  {selectedItem?.label || field.value}
                                </span>
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-muted-foreground">Select Platform</span>
                        )}
                        <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0 ml-2" />
                      </Button>
                    </PopoverTrigger>
                  </FormControl>
                  <PopoverContent
                    className="z-[50] w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1"
                    align="start"
                  >
                    {NEW_ACCOUNT_SOCIAL_PLATFORMS.map((platform) => {
                      const Icon = platform.icon

                      return (
                        <PopoverClose asChild key={platform.value}>
                          <div
                            onClick={() => field.onChange(platform.value)}
                            className="cursor-pointer flex items-center justify-between w-full min-w-0 gap-2 px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Icon size={16} className="flex-shrink-0" />
                              <span className="truncate">{platform.label}</span>
                            </div>
                          </div>
                        </PopoverClose>
                      )
                    })}
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isActive && hasPlatform && (
          <div className="flex items-center gap-4 w-full p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {social.profile_picture_url && !imageError && (
                <img
                  src={social.profile_picture_url}
                  alt={
                    social.nickname ||
                    social.username ||
                    social.handle ||
                    social.platform
                  }
                  className="w-12 h-12 rounded-full font-inter flex-shrink-0 border dark:border-white/5 border-black/5"
                  onError={() => onImageError(index)}
                />
              )}
              {(!social.profile_picture_url || imageError) && (
                <div className="w-12 h-12 rounded-full font-inter font-bold bg-muted flex items-center justify-center flex-shrink-0 border dark:border-white/5 border-black/5">
                  {getPlatformIcon(social.platform || social.network, 24)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium truncate">
                  {social.nickname || `${platformLabel} Account`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                </div>
              </div>
            </div>
            {isOAuthConnectablePlatform(social.platform) && (
              <Button
                variant="outline"
                type="button"
                onClick={() => onConnect(index)}
                className="whitespace-nowrap"
              >
                Reconnect
              </Button>
            )}
            {social.platform === "bluesky" && siteId && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  form.setValue(`social_media.${index}.isActive`, false)
                }}
                className="whitespace-nowrap"
              >
                Reconnect
              </Button>
            )}
          </div>
        )}

        {hasPlatform && !isActive && isOAuthConnectablePlatform(social.platform) && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full font-inter font-bold bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 text-orange-600">
                {getPlatformIcon(social.platform || social.network, 20)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-orange-800 dark:text-orange-200">
                  Action Required
                </p>
                {social.username || social.handle ? (
                  <>
                    <p className="text-sm text-muted-foreground truncate">
                      {social.username || social.handle}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                      Connection lost - reconnect to continue
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Authenticate to connect this account
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="default"
              type="button"
              onClick={() => onConnect(index)}
              className="whitespace-nowrap bg-orange-600 hover:bg-orange-700 text-white"
            >
              {social.username || social.handle || social.nickname
                ? "Reconnect"
                : "Connect Account"}
            </Button>
          </div>
        )}

        {hasPlatform && !isActive && social.platform === "bluesky" && siteId && (
          canConnectAccount ? (
            <BlueskyConnectForm siteId={siteId} onConnected={onConnected} />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenAccountLimit}
            >
              Upgrade to connect
            </Button>
          )
        )}

        {hasPlatform &&
          !isActive &&
          !isOAuthConnectablePlatform(social.platform) &&
          social.platform !== "bluesky" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {platformFields.fields.includes("url") && (
                <FormField
                  control={form.control}
                  name={`social_media.${index}.url`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platformFields.labels.url}</FormLabel>
                      <FormControl>
                        <Input placeholder={platformFields.placeholders.url} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {platformFields.fields.includes("handle") && (
                <FormField
                  control={form.control}
                  name={`social_media.${index}.handle`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platformFields.labels.handle}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={platformFields.placeholders.handle}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {platformFields.fields.includes("phone") && (
                <FormField
                  control={form.control}
                  name={`social_media.${index}.phone`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platformFields.labels.phone}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={platformFields.placeholders.phone}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {platformFields.fields.includes("phoneCode") && (
                <FormField
                  control={form.control}
                  name={`social_media.${index}.phoneCode`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platformFields.labels.phoneCode}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Country Code" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNTRY_CODES.map((code) => (
                            <SelectItem key={code.value} value={code.value}>
                              {code.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {platformFields.fields.includes("inviteCode") && (
                <FormField
                  control={form.control}
                  name={`social_media.${index}.inviteCode`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platformFields.labels.inviteCode}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={platformFields.placeholders.inviteCode}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}
      </SectionCardContent>

      {!(isActive && hasPlatform) && (
        <SectionCardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSave(index)}
            disabled={isSaving || !form.formState.isDirty}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full font-inter border-2 border-current border-t-transparent" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </SectionCardFooter>
      )}
    </SectionCard>
  )
}
