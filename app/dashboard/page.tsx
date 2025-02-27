"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { Overview } from "@/app/components/dashboard/overview"
import { SegmentMetrics } from "@/app/components/dashboard/segment-metrics"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuthContext()
  const router = useRouter()
  const [localLoading, setLocalLoading] = useState(true)

  // Verificación explícita de autenticación - Doble seguridad
  useEffect(() => {
    console.log("[Dashboard] Estado de autenticación:", { isAuthenticated, isLoading, user })
    
    // Si no está cargando y no está autenticado, redirigir al login
    if (!isLoading && !isAuthenticated) {
      console.log("[Dashboard] Usuario no autenticado, redirigiendo a login")
      router.push("/auth/login?returnTo=/dashboard")
    }
    
    // Permitir un poco de tiempo para que los componentes se carguen correctamente
    const timer = setTimeout(() => {
      setLocalLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, router, user])

  // Pantalla de carga mejorada con retroalimentación visual
  if (isLoading || localLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-4"></div>
        <p className="text-lg text-gray-700">Cargando el dashboard...</p>
        <p className="text-sm text-gray-500 mt-2">Por favor espera mientras verificamos tu sesión</p>
      </div>
    )
  }

  // Doble verificación: si de alguna manera llega aquí sin autenticación, mostrar mensaje
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center">No autorizado</h2>
          <p className="mb-4 text-gray-600">
            No tienes permiso para acceder a esta página. Serás redirigido a la página de inicio de sesión.
          </p>
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => router.push("/auth/login?returnTo=/dashboard")}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Contenido principal del dashboard
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="overview">
        <StickyHeader>
          <div className="px-16 pt-0">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="segments">Segments</TabsTrigger>
              <TabsTrigger value="experiments">Experiments</TabsTrigger>
            </TabsList>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Segments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">
                      +2 from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Experiments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">8</div>
                    <p className="text-xs text-muted-foreground">
                      +3 from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">573</div>
                    <p className="text-xs text-muted-foreground">
                      +201 from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Conversion Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">24.3%</div>
                    <p className="text-xs text-muted-foreground">
                      +5.1% from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      ROI
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">342%</div>
                    <p className="text-xs text-muted-foreground">
                      +28% from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      CAC
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$48.2</div>
                    <p className="text-xs text-muted-foreground">
                      -12% from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      CPC
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$2.4</div>
                    <p className="text-xs text-muted-foreground">
                      -0.8% from last month
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      LTV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$850</div>
                    <p className="text-xs text-muted-foreground">
                      +15% from last month
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                  <CardHeader>
                    <CardTitle>Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="pl-2">
                    <Overview />
                  </CardContent>
                </Card>
                <Card className="col-span-3">
                  <CardHeader>
                    <CardTitle>Segment Metrics</CardTitle>
                    <CardDescription>
                      Performance by segment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SegmentMetrics />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="segments" className="space-y-4">
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Top Performing Segments</CardTitle>
                  <CardDescription>
                    Segments with highest engagement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivity />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="experiments" className="space-y-4">
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Recent Experiments</CardTitle>
                  <CardDescription>
                    Latest experiment results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivity />
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 