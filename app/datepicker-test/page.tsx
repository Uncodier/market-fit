"use client"

import React from "react"
import { DatePickerExample } from "@/app/components/DatePickerExample"

export default function DatePickerTestPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Date Picker Testing</h1>
      <DatePickerExample />
    </div>
  )
} 