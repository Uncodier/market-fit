import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { subDays, subMonths, format, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

interface Transaction {
  id: string;
  campaign_id: string;
  type: 'fixed' | 'variable';
  amount: number;
  description: string | null;
  category: string;
  date: string;
  created_at: string;
  currency: string;
  site_id: string;
  user_id: string;
  updated_at: string;
}

// Define category groups for better reporting
const CATEGORY_GROUPS: Record<string, string> = {
  // Marketing expenses
  advertising: "Marketing",
  content: "Marketing",
  adspend: "Marketing",
  seo: "Marketing",
  social: "Marketing",
  email: "Marketing",
  events: "Marketing",
  print: "Marketing",
  sponsorship: "Marketing",
  
  // Sales expenses
  sales_commission: "Sales",
  sales_travel: "Sales",
  crm: "Sales",
  
  // Technology expenses
  software: "Technology",
  hosting: "Technology",
  tools: "Technology",
  
  // Operational expenses
  freelance: "Operations",
  agency: "Operations",
  consulting: "Operations",
  research: "Operations",
  utilities: "Operations",
  rent: "Operations",
  
  // Administrative expenses
  salaries: "Administration",
  insurance: "Administration",
  legal: "Administration",
  travel: "Administration",
  training: "Administration",
  
  // Default
  other: "Other"
};

export async function GET(request: NextRequest) {
  try {
    // Obtener parámetros de consulta
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const segmentId = searchParams.get('segmentId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Validar ID del sitio
    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // Inicializar cliente Supabase
    const supabase = await createClient();
    
    // Parsear fechas
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam ? new Date(startDateParam) : subDays(endDate, 30);
    
    // Calcular período anterior
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousPeriodEnd = new Date(startDate.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);
    
    // Formatear fechas para consultas SQL
    const startDateFormatted = format(startDate, 'yyyy-MM-dd');
    const endDateFormatted = format(endDate, 'yyyy-MM-dd');
    const prevStartFormatted = format(previousPeriodStart, 'yyyy-MM-dd');
    const prevEndFormatted = format(previousPeriodEnd, 'yyyy-MM-dd');
    
    // Determinar tipo de período
    let periodType = "custom";
    const daysDiff = Math.floor(periodLength / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) periodType = "daily";
    else if (daysDiff <= 7) periodType = "weekly";
    else if (daysDiff <= 31) periodType = "monthly";
    else if (daysDiff <= 92) periodType = "quarterly";
    else periodType = "yearly";
    
    // Buscar campañas para este sitio
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('site_id', siteId);
    
    const campaignIds = campaigns?.map(campaign => campaign.id) || [];
    
    // Obtener transacciones para el período actual
    const { data: currentTransactions, error: currentError } = await supabase
      .from('transactions')
      .select('*')
      .eq('site_id', siteId)
      .gte('date', startDateFormatted)
      .lte('date', endDateFormatted);
    
    if (currentError) {
      console.error('Error fetching current transactions:', currentError);
      return NextResponse.json(
        { error: 'Failed to fetch transaction data' },
        { status: 500 }
      );
    }
    
    // Filtrar por campañas si es necesario
    let filteredTransactions = currentTransactions || [];
    if (campaignIds.length > 0) {
      filteredTransactions = filteredTransactions.filter(tx => 
        campaignIds.includes(tx.campaign_id)
      );
    }
    
    // Obtener transacciones para el período anterior
    const { data: prevData } = await supabase
      .from('transactions')
      .select('*')
      .eq('site_id', siteId)
      .gte('date', prevStartFormatted)
      .lte('date', prevEndFormatted);
    
    // Filtrar por campañas si es necesario
    let prevTransactions = prevData || [];
    if (campaignIds.length > 0) {
      prevTransactions = prevTransactions.filter(tx => 
        campaignIds.includes(tx.campaign_id)
      );
    }
    
    // Si no hay datos, devolver respuesta vacía
    if (filteredTransactions.length === 0) {
      return NextResponse.json({
        totalCosts: {
          actual: 0,
          previous: 0,
          percentChange: 0,
          formattedActual: "0",
          formattedPrevious: "0"
        },
        costCategories: [],
        monthlyData: [],
        costDistribution: [],
        periodType,
        noData: true,
        metadata: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          prevStartDate: previousPeriodStart.toISOString(),
          prevEndDate: previousPeriodEnd.toISOString(),
          segmentId: segmentId || 'all'
        }
      });
    }
    
    // Calcular costos totales
    const totalCosts = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
    const prevTotalCosts = prevTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
    const percentChange = prevTotalCosts > 0 ? ((totalCosts - prevTotalCosts) / prevTotalCosts) * 100 : 0;

    // Calcular costos fijos/variables
    const fixedCosts = filteredTransactions.filter(tx => tx.type === 'fixed').reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
    const variableCosts = filteredTransactions.filter(tx => tx.type === 'variable').reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
    const prevFixedCosts = prevTransactions.filter(tx => tx.type === 'fixed').reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
    const prevVariableCosts = prevTransactions.filter(tx => tx.type === 'variable').reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
    
    // Agrupar por categoría
    const categories = new Map<string, number>();
    const prevCategories = new Map<string, number>();
    
    // Función para obtener el grupo de categoría
    const getCategoryGroup = (tx: Transaction): string => {
      const categoryKey = tx.category || "other";
      return CATEGORY_GROUPS[categoryKey] || "Other";
    };
    
    // Agrupar transacciones actuales por categoría
    filteredTransactions.forEach(tx => {
      const categoryGroup = getCategoryGroup(tx);
      const amount = parseFloat(tx.amount.toString());
      categories.set(categoryGroup, (categories.get(categoryGroup) || 0) + amount);
    });
    
    // Agrupar transacciones anteriores por categoría
    prevTransactions.forEach(tx => {
      const categoryGroup = getCategoryGroup(tx);
      const amount = parseFloat(tx.amount.toString());
      prevCategories.set(categoryGroup, (prevCategories.get(categoryGroup) || 0) + amount);
    });
    
    // Crear array de categorías con porcentajes de cambio
    const costCategories = Array.from(categories.entries()).map(([name, amount]) => {
      const prevAmount = prevCategories.get(name) || 0;
      const percentChange = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : 0;
      return {
        name,
        amount,
        prevAmount,
        percentChange: parseFloat(percentChange.toFixed(1))
      };
    });
    
    // Crear distribución de costos con porcentajes
    const costDistribution = Array.from(categories.entries()).map(([category, amount]) => {
      const percentage = totalCosts > 0 ? Math.round((amount / totalCosts) * 100) : 0;
      return {
        category,
        percentage,
        amount
      };
    });
    
    // Datos mensuales para los últimos 6 meses
    const monthlyData = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const month = monthDate.toLocaleString('en-US', { month: 'short' });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Filtrar transacciones para este mes
      const monthFixedCosts = filteredTransactions
        .filter(tx => {
          const txDate = parseISO(tx.date);
          return tx.type === 'fixed' && txDate >= monthStart && txDate <= monthEnd;
        })
        .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
        
      const monthVariableCosts = filteredTransactions
        .filter(tx => {
          const txDate = parseISO(tx.date);
          return tx.type === 'variable' && txDate >= monthStart && txDate <= monthEnd;
        })
        .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
      
      monthlyData.push({
        month,
        fixedCosts: monthFixedCosts,
        variableCosts: monthVariableCosts
      });
    }
    
    // Devolver respuesta formateada
    return NextResponse.json({
      totalCosts: {
        actual: totalCosts,
        previous: prevTotalCosts,
        percentChange,
        formattedActual: totalCosts.toLocaleString(),
        formattedPrevious: prevTotalCosts.toLocaleString()
      },
      costCategories,
      monthlyData,
      costDistribution,
      periodType,
      metadata: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        prevStartDate: previousPeriodStart.toISOString(),
        prevEndDate: previousPeriodEnd.toISOString(),
        segmentId: segmentId || 'all'
      }
    });
    
  } catch (error) {
    console.error('Error in Costs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 