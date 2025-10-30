import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const segmentId = searchParams.get("segmentId");

  if (!siteId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    
    // Calculate previous period for comparison
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodLength);

    // Get commands tokens for current period - with pagination
    let commandsData: any[] = [];
    let commandsError: any = null;
    let from = 0;
    const limit = 1000;

    while (true) {
      const { data: batch, error } = await supabase
        .from("commands")
        .select("input_tokens, output_tokens, created_at")
        .eq("site_id", siteId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(from, from + limit - 1)
        .order("created_at", { ascending: true });

      if (error) {
        commandsError = error;
        break;
      }

      if (!batch || batch.length === 0) {
        break;
      }

      commandsData = commandsData.concat(batch);
      from += limit;

      // If we got less than the limit, we've reached the end
      if (batch.length < limit) {
        break;
      }
    }

    if (commandsError) {
      console.error("Error fetching commands tokens:", commandsError);
    }


    // Get instance_logs tokens for current period - with pagination
    let instanceLogsData: any[] = [];
    let instanceLogsError: any = null;
    let instanceLogsFrom = 0;

    while (true) {
      const { data: batch, error } = await supabase
        .from("instance_logs")
        .select("tokens_used, created_at")
        .eq("site_id", siteId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .range(instanceLogsFrom, instanceLogsFrom + limit - 1)
        .order("created_at", { ascending: true });

      if (error) {
        instanceLogsError = error;
        break;
      }

      if (!batch || batch.length === 0) {
        break;
      }

      instanceLogsData = instanceLogsData.concat(batch);
      instanceLogsFrom += limit;

      // If we got less than the limit, we've reached the end
      if (batch.length < limit) {
        break;
      }
    }

    if (instanceLogsError) {
      console.error("Error fetching instance_logs tokens:", instanceLogsError);
    }

    console.log(`[Token Usage API] Data counts: commands=${commandsData?.length || 0}, instance_logs=${instanceLogsData?.length || 0}`);
    console.log(`[Token Usage API] Date range: ${startDate} to ${endDate}`);


    // Calculate current totals - separate input and output
    const commandsInputTotal = commandsData?.reduce((sum, cmd) => sum + (cmd.input_tokens || 0), 0) || 0;
    const commandsOutputTotal = commandsData?.reduce((sum, cmd) => sum + (cmd.output_tokens || 0), 0) || 0;
    
    const instanceLogsInput = instanceLogsData?.reduce((sum, log) => {
      const tokens = log.tokens_used as any;
      if (tokens && typeof tokens === 'object') {
        // Map promptTokens to input tokens
        return sum + (tokens.promptTokens || 0);
      }
      return sum;
    }, 0) || 0;

    const instanceLogsOutput = instanceLogsData?.reduce((sum, log) => {
      const tokens = log.tokens_used as any;
      if (tokens && typeof tokens === 'object') {
        // Map completionTokens to output tokens
        return sum + (tokens.completionTokens || 0);
      }
      return sum;
    }, 0) || 0;

    const totalInputTokens = commandsInputTotal + instanceLogsInput;
    const totalOutputTokens = commandsOutputTotal + instanceLogsOutput;
    const totalTokens = totalInputTokens + totalOutputTokens;

    // Get previous period data for comparison - with pagination
    let prevCommandsData: any[] = [];
    let prevFrom = 0;

    while (true) {
      const { data: batch, error } = await supabase
        .from("commands")
        .select("input_tokens, output_tokens")
        .eq("site_id", siteId)
        .gte("created_at", previousStart.toISOString())
        .lte("created_at", previousEnd.toISOString())
        .range(prevFrom, prevFrom + limit - 1)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching previous commands:", error);
        break;
      }

      if (!batch || batch.length === 0) {
        break;
      }

      prevCommandsData = prevCommandsData.concat(batch);
      prevFrom += limit;

      if (batch.length < limit) {
        break;
      }
    }

    let prevInstanceLogsData: any[] = [];
    let prevLogsFrom = 0;

    while (true) {
      const { data: batch, error } = await supabase
        .from("instance_logs")
        .select("tokens_used")
        .eq("site_id", siteId)
        .gte("created_at", previousStart.toISOString())
        .lte("created_at", previousEnd.toISOString())
        .range(prevLogsFrom, prevLogsFrom + limit - 1)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching previous instance_logs:", error);
        break;
      }

      if (!batch || batch.length === 0) {
        break;
      }

      prevInstanceLogsData = prevInstanceLogsData.concat(batch);
      prevLogsFrom += limit;

      if (batch.length < limit) {
        break;
      }
    }

    const prevCommandsTotal = prevCommandsData?.reduce((sum, cmd) => 
      sum + (cmd.input_tokens || 0) + (cmd.output_tokens || 0), 0) || 0;
    
    const prevInstanceLogsTotal = prevInstanceLogsData?.reduce((sum, log) => {
      const tokens = log.tokens_used as any;
      if (tokens && typeof tokens === 'object') {
        const prompt = tokens.promptTokens || 0;
        const completion = tokens.completionTokens || 0;
        return sum + prompt + completion;
      }
      return sum;
    }, 0) || 0;

    const prevTotalTokens = prevCommandsTotal + prevInstanceLogsTotal;

    const percentChange = prevTotalTokens > 0 
      ? ((totalTokens - prevTotalTokens) / prevTotalTokens) * 100 
      : totalTokens > 0 ? 100 : 0;

    // Group data by day for chart - separate input and output
    const chartData = [];
    const currentDate = new Date(currentStart);
    const endDateObj = new Date(currentEnd);

    console.log(`[Token Usage API] Processing days from ${currentStart.toISOString()} to ${currentEnd.toISOString()}`);
    let dayCount = 0;

    while (currentDate <= endDateObj) {
      dayCount++;
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Use date string comparison for more reliable filtering
      const dayStartStr = dayStart.toISOString().split('T')[0];
      const dayEndStr = dayEnd.toISOString().split('T')[0];

      const dayCommands = commandsData?.filter(cmd => {
        const cmdDateStr = cmd.created_at.split('T')[0];
        return cmdDateStr >= dayStartStr && cmdDateStr <= dayEndStr;
      }) || [];

      const dayInstanceLogs = instanceLogsData?.filter(log => {
        const logDateStr = log.created_at.split('T')[0];
        return logDateStr >= dayStartStr && logDateStr <= dayEndStr;
      }) || [];


      const dayCommandsInput = dayCommands.reduce((sum, cmd) => 
        sum + (cmd.input_tokens || 0), 0);
      
      const dayCommandsOutput = dayCommands.reduce((sum, cmd) => 
        sum + (cmd.output_tokens || 0), 0);

      const dayInstanceLogsInput = dayInstanceLogs.reduce((sum, log) => {
        const tokens = log.tokens_used as any;
        if (tokens && typeof tokens === 'object') {
          return sum + (tokens.promptTokens || 0);
        }
        return sum;
      }, 0);

      const dayInstanceLogsOutput = dayInstanceLogs.reduce((sum, log) => {
        const tokens = log.tokens_used as any;
        if (tokens && typeof tokens === 'object') {
          return sum + (tokens.completionTokens || 0);
        }
        return sum;
      }, 0);

      const dayInputTotal = dayCommandsInput + dayInstanceLogsInput;
      const dayOutputTotal = dayCommandsOutput + dayInstanceLogsOutput;


      chartData.push({
        date: currentDate.toISOString().split('T')[0],
        commands: dayCommandsInput + dayCommandsOutput,
        instanceLogs: dayInstanceLogsInput + dayInstanceLogsOutput,
        inputTokens: dayInputTotal,
        outputTokens: dayOutputTotal
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[Token Usage API] Processed ${dayCount} days, generated ${chartData.length} data points`);

    return NextResponse.json({
      actual: totalTokens,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly",
      chartData,
      breakdown: {
        commands: commandsInputTotal + commandsOutputTotal,
        instanceLogs: instanceLogsInput + instanceLogsOutput,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens
      }
    });

  } catch (error) {
    console.error("Error in tokens API:", error);
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly",
      chartData: [],
      breakdown: {
        commands: 0,
        instanceLogs: 0,
        inputTokens: 0,
        outputTokens: 0
      }
    });
  }
}
