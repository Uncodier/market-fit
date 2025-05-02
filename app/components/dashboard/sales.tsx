"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { PercentageIndicator } from "@/app/components/ui/percentage-indicator"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { useSite } from "@/app/context/SiteContext"
import { useState, useEffect } from "react"

// Definimos la interfaz IconProps localmente
interface IconProps {
  className?: string
  size?: number
  style?: React.CSSProperties
  onClick?: () => void
  "aria-hidden"?: boolean
}

// Necesitamos definir estos iconos específicos manualmente
const IconWrapper = ({ 
  children, 
  className = "", 
  size = 20, 
  style,
  ...props 
}: React.PropsWithChildren<IconProps>) => {
  return (
    <div 
      className={`inline-flex items-center justify-center ${className}`}
      style={{ 
        width: size, 
        height: size,
        minWidth: size,
        minHeight: size,
        ...style
      }}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  )
}

const DollarSign = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  </IconWrapper>
)

const ShoppingCart = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
  </IconWrapper>
)

const ShoppingBag = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <path d="M16 10a4 4 0 0 1-8 0"></path>
    </svg>
  </IconWrapper>
)

const CreditCard = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
      <line x1="1" y1="10" x2="23" y2="10"></line>
    </svg>
  </IconWrapper>
)

interface SalesWidgetProps {
  startDate?: Date;
  endDate?: Date;
  segmentId?: string;
}

export function TotalSalesWidget({ startDate, endDate, segmentId = "all" }: SalesWidgetProps) {
  const { currentSite } = useSite();
  const [isLoading, setIsLoading] = useState(true);
  const [totalSales, setTotalSales] = useState({
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: "$0",
    formattedPrevious: "$0"
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      
      try {
        const url = `/api/revenue/total?siteId=${currentSite.id}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}${segmentId !== "all" ? `&segmentId=${segmentId}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch total sales data');
        }
        
        const data = await response.json();
        setTotalSales(data);
      } catch (error) {
        console.error("Error fetching total sales data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite, startDate, endDate, segmentId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Total Revenue
        </CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[120px] mb-2" />
        ) : (
          <>
            <div className="text-2xl font-bold">{totalSales.formattedActual}</div>
            <div className="flex items-center">
              <PercentageIndicator value={totalSales.percentChange} />
              <p className="text-xs text-muted-foreground ml-2">
                vs. previous period
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function OnlineSalesWidget({ startDate, endDate, segmentId = "all" }: SalesWidgetProps) {
  const { currentSite } = useSite();
  const [isLoading, setIsLoading] = useState(true);
  const [onlineSales, setOnlineSales] = useState({
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: "$0",
    formattedPrevious: "$0"
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      
      try {
        const url = `/api/revenue/online?siteId=${currentSite.id}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}${segmentId !== "all" ? `&segmentId=${segmentId}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch online sales data');
        }
        
        const data = await response.json();
        setOnlineSales(data);
      } catch (error) {
        console.error("Error fetching online sales data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite, startDate, endDate, segmentId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Online Sales
        </CardTitle>
        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[120px] mb-2" />
        ) : (
          <>
            <div className="text-2xl font-bold">{onlineSales.formattedActual}</div>
            <div className="flex items-center">
              <PercentageIndicator value={onlineSales.percentChange} />
              <p className="text-xs text-muted-foreground ml-2">
                vs. previous period
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function RetailSalesWidget({ startDate, endDate, segmentId = "all" }: SalesWidgetProps) {
  const { currentSite } = useSite();
  const [isLoading, setIsLoading] = useState(true);
  const [retailSales, setRetailSales] = useState({
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: "$0",
    formattedPrevious: "$0"
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      
      try {
        const url = `/api/revenue/retail?siteId=${currentSite.id}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}${segmentId !== "all" ? `&segmentId=${segmentId}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch retail sales data');
        }
        
        const data = await response.json();
        setRetailSales(data);
      } catch (error) {
        console.error("Error fetching retail sales data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite, startDate, endDate, segmentId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Retail Sales
        </CardTitle>
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[120px] mb-2" />
        ) : (
          <>
            <div className="text-2xl font-bold">{retailSales.formattedActual}</div>
            <div className="flex items-center">
              <PercentageIndicator value={retailSales.percentChange} />
              <p className="text-xs text-muted-foreground ml-2">
                vs. previous period
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function AOVWidget({ startDate, endDate, segmentId = "all" }: SalesWidgetProps) {
  const { currentSite } = useSite();
  const [isLoading, setIsLoading] = useState(true);
  const [aovData, setAOVData] = useState({
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: "$0",
    formattedPrevious: "$0"
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!currentSite || currentSite.id === "default") return;
      
      setIsLoading(true);
      
      try {
        const url = `/api/revenue/aov?siteId=${currentSite.id}${startDate ? `&startDate=${startDate.toISOString()}` : ''}${endDate ? `&endDate=${endDate.toISOString()}` : ''}${segmentId !== "all" ? `&segmentId=${segmentId}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch AOV data');
        }
        
        const data = await response.json();
        setAOVData(data);
      } catch (error) {
        console.error("Error fetching AOV data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSite, startDate, endDate, segmentId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Average Order Value
        </CardTitle>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-[120px] mb-2" />
        ) : (
          <>
            <div className="text-2xl font-bold">{aovData.formattedActual}</div>
            <div className="flex items-center">
              <PercentageIndicator value={aovData.percentChange} />
              <p className="text-xs text-muted-foreground ml-2">
                vs. previous period
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
} 