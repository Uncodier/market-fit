"use client";

import React, { useEffect, useState } from "react";
import { CostReports } from "@/app/components/dashboard/cost-reports";
import { Separator } from "@/app/components/ui/separator";
import { subDays } from "date-fns";

// Función principal de la página de costos
export default function CostsPage() {
  // Inicializamos fechas por defecto
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    return subDays(date, 30); // Por defecto, mostrar último mes
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [segmentId, setSegmentId] = useState<string>("all");
  
  // Intentar obtener las fechas de la URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      
      // Obtener fechas de la URL si están presentes
      const startDateParam = url.searchParams.get('startDate');
      const endDateParam = url.searchParams.get('endDate');
      const segmentParam = url.searchParams.get('segmentId');
      
      if (startDateParam) {
        setStartDate(new Date(startDateParam));
      }
      
      if (endDateParam) {
        setEndDate(new Date(endDateParam));
      }
      
      if (segmentParam) {
        setSegmentId(segmentParam);
      }
      
      console.log('[CostsPage] URL params applied:', { 
        startDate: startDateParam, 
        endDate: endDateParam,
        segmentId: segmentParam 
      });
    }
  }, []);

  return (
    <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Costs</h2>
          <p className="text-muted-foreground">
            View and analyze your business costs in this report.
          </p>
        </div>
      </div>
      <Separator />
      <CostReports 
        startDate={startDate}
        endDate={endDate}
        segmentId={segmentId}
      />
    </div>
  );
} 