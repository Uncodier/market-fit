"use client"

import { Card, CardContent } from "../../ui/card"
import { Slider } from "../../ui/slider"
import { FormControl, FormField, FormItem } from "../../ui/form"
import { getFocusModeConfig } from "../utils/focus-mode-config"
import { cn } from "@/lib/utils"

interface FocusModeStepProps {
  form: any
}

export function FocusModeStep({ form }: FocusModeStepProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="focusMode"
        render={({ field }) => {
          const config = getFocusModeConfig(field.value)
          return (
            <FormItem>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-blue-600">Sales Focus</span>
                    <span className="text-sm font-medium text-green-600">Growth Focus</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      max={100}
                      step={1}
                      className="py-4"
                    />
                  </FormControl>
                </div>
                
                <Card className={cn("border-2", config.borderColor, config.bgColor)}>
                  <CardContent className="p-4">
                    <h3 className={cn("text-lg font-semibold mb-2", config.color)}>
                      {config.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {config.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </FormItem>
          )
        }}
      />
    </div>
  )
} 