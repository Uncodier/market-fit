"use client"

import React, { useState } from "react"
import { DatePicker, DateEvent } from "@/app/components/ui/date-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { addDays, subDays, format, startOfDay, subMonths } from "date-fns"
import { Badge } from "@/app/components/ui/badge"

export function DatePickerExample() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedDate2, setSelectedDate2] = useState<Date>(new Date())
  const [selectedDate3, setSelectedDate3] = useState<Date>(new Date())
  const [selectedDate4, setSelectedDate4] = useState<Date>(new Date())
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  
  // Custom events example
  const customEvents: DateEvent[] = [
    { label: "Today", value: new Date(), type: "day", period: "current" },
    { label: "Yesterday", value: subDays(new Date(), 1), type: "day", period: "past" },
    { label: "Last Week", value: subDays(new Date(), 7), type: "week", period: "past" },
    { label: "Last Month", value: subMonths(new Date(), 1), type: "month", period: "past" }
  ]
  
  // Handle range selection
  const handleRangeSelect = (start: Date, end: Date) => {
    setRangeStart(start)
    setRangeEnd(end)
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Date Picker Example</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Task Mode - Scheduling Future Events:</p>
          <DatePicker 
            date={selectedDate}
            setDate={setSelectedDate}
            className="w-full"
            position="bottom"
            mode="task"
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Task Mode with Time Picker (12h format):</p>
          <DatePicker 
            date={selectedDate}
            setDate={setSelectedDate}
            className="w-full"
            position="bottom"
            mode="task"
            showTimePicker={true}
            timeFormat="12h"
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Task Mode with Time Picker (24h format):</p>
          <DatePicker 
            date={selectedDate2}
            setDate={setSelectedDate2}
            className="w-full"
            position="bottom"
            mode="task"
            showTimePicker={true}
            timeFormat="24h"
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Report Mode - Date Ranges for Analysis:</p>
          <DatePicker 
            date={selectedDate2}
            setDate={setSelectedDate2}
            className="w-full"
            position="bottom"
            mode="report"
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Calendar Mode - Navigation Between Dates:</p>
          <DatePicker 
            date={selectedDate3}
            setDate={setSelectedDate3}
            className="w-full"
            position="bottom"
            mode="calendar"
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Default Mode:</p>
          <DatePicker 
            date={selectedDate4}
            setDate={setSelectedDate4}
            className="w-full"
            position="bottom"
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">Date Range Example with Report Mode:</p>
          <div className="mb-2">
            {rangeStart && rangeEnd ? (
              <div className="flex gap-2 items-center">
                <Badge variant="outline" className="text-xs py-1">
                  {format(rangeStart, "MMM d")} {format(rangeStart, "yyyy")}
                </Badge>
                <span>to</span>
                <Badge variant="outline" className="text-xs py-1">
                  {format(rangeEnd, "MMM d")} {format(rangeEnd, "yyyy")}
                </Badge>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Select a date/range</span>
            )}
          </div>
          <DatePicker 
            date={selectedDate}
            setDate={setSelectedDate}
            className="w-full"
            position="bottom"
            mode="report"
            onRangeSelect={handleRangeSelect}
          />
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-2">With Modal-Like Container:</p>
          <div className="border p-6 rounded-md max-w-md mx-auto">
            <p className="text-sm mb-4">This simulates a modal or dialog:</p>
            <div className="relative z-[150]">
              <DatePicker 
                date={selectedDate}
                setDate={setSelectedDate}
                position="top"
                className="w-full"
                mode="task"
              />
            </div>
          </div>
        </div>
        
        <div>
          <p className="text-sm">Selected Date: <span className="font-medium">{selectedDate.toLocaleDateString()}</span></p>
          <p className="text-sm">Selected Time: <span className="font-medium">{selectedDate.toLocaleTimeString()}</span></p>
          <p className="text-sm">Full DateTime: <span className="font-medium">{selectedDate.toString()}</span></p>
        </div>
      </CardContent>
    </Card>
  )
} 