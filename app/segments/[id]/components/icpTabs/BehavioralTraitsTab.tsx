import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { 
  User, BarChart, Globe, ShoppingCart, CalendarIcon, FileText, 
  PieChart, CheckCircle2, HelpCircle, MessageSquare, Tag
} from "@/app/components/ui/icons";
import { SectionCard, AttributeCard } from "../common/Cards";
import { ImportanceIndicator } from "../common/Indicators";
import { ICPProfileData } from "../types";
import { SpiderChart } from "../common/SpiderChart";

interface BehavioralTraitsTabProps {
  icpProfile: ICPProfileData;
}

export const BehavioralTraitsTab = ({ icpProfile }: BehavioralTraitsTabProps) => {
  // Verificar que icpProfile existe
  if (!icpProfile) {
    return <div className="p-4 text-center">No profile data available</div>;
  }

  // Obtener datos de behavioralTraits
  const behavioralTraits = icpProfile.behavioralTraits || {};
  const onlineBehavior = behavioralTraits.onlineBehavior || {};
  const purchasingBehavior = behavioralTraits.purchasingBehavior || {};
  const contentConsumption = behavioralTraits.contentConsumption || {};

  // Transform decision factors for spider chart
  const decisionFactorItems = purchasingBehavior.decisionFactors?.map((factor: {name: string; importance: string; description: string}) => ({
    name: factor?.name || '',
    value: (factor?.importance === "Very high" ? 1 : 
           factor?.importance === "High" ? 0.8 : 
           factor?.importance === "Medium" ? 0.6 : 
           factor?.importance === "Low" ? 0.4 : 0.2),
    color: "rgba(124, 58, 237, 0.8)" // Purple color
  })) || [];

  // Transform social platforms for spider chart
  const socialPlatformItems = onlineBehavior.socialPlatforms?.map((platform: {name: string; usageFrequency: string; engagementLevel: string; relevance: string}) => ({
    name: platform?.name || '',
    value: (platform?.relevance === "Very high" ? 1 : 
           platform?.relevance === "High" ? 0.8 : 
           platform?.relevance === "Medium" ? 0.6 : 
           platform?.relevance === "Low" ? 0.4 : 0.2),
    color: "rgba(59, 130, 246, 0.8)" // Blue color
  })) || [];

  // Transform content preferences for spider chart
  const contentPreferenceItems = contentConsumption.preferredFormats?.map((format: {type: string; preference: string}) => ({
    name: format?.type || '',
    value: (format?.preference === "Very high" ? 1 : 
           format?.preference === "High" ? 0.8 : 
           format?.preference === "Medium" ? 0.6 : 
           format?.preference === "Low" ? 0.4 : 0.2),
    color: "rgba(16, 185, 129, 0.8)" // Green color
  })) || [];

  // Función para convertir relevancia a badge variant
  const getBadgeVariant = (relevance: string) => {
    if (relevance === "Very high" || relevance === "High") return "indigo";
    if (relevance === "Medium" || relevance === "Medium-high") return "secondary";
    return "outline";
  };

  // Función para obtener el icono de dispositivo
  const getDeviceIcon = (deviceType: string) => {
    const lowerDevice = deviceType.toLowerCase();
    if (lowerDevice.includes('mobile') || lowerDevice.includes('phone')) {
      return <User className="h-6 w-6" />;
    } else if (lowerDevice.includes('laptop')) {
      return <FileText className="h-6 w-6" />;
    } else if (lowerDevice.includes('tablet') || lowerDevice.includes('ipad')) {
      return <PieChart className="h-6 w-6" />;
    } else if (lowerDevice.includes('desktop') || lowerDevice.includes('pc')) {
      return <Globe className="h-6 w-6" />;
    }
    return <User className="h-6 w-6" />;
  };

  // Calcular porcentajes para la visualización de dispositivos
  const calculateDevicePercentage = (usage: string) => {
    if (usage === 'primary') return 100;
    if (usage === 'secondary') return 65;
    if (usage === 'tertiary') return 35;
    return 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Device Usage Section - Improved visualization */}
      <SectionCard title="Device Usage" icon={<User className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="bg-muted/20 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-4">Device Preference</h4>
            
            {/* Primary Device */}
            {onlineBehavior.deviceUsage?.primary && (
              <div className="mb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(onlineBehavior.deviceUsage.primary)}
                    <span className="text-sm font-medium">{onlineBehavior.deviceUsage.primary}</span>
                  </div>
                  <Badge variant="indigo">Primary</Badge>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-2.5">
                  <div className="bg-[rgb(99,102,241)] rounded-full h-2.5" style={{ width: '100%' }}></div>
                </div>
              </div>
            )}
            
            {/* Secondary Device */}
            {onlineBehavior.deviceUsage?.secondary && (
              <div className="mb-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(onlineBehavior.deviceUsage.secondary)}
                    <span className="text-sm font-medium">{onlineBehavior.deviceUsage.secondary}</span>
                  </div>
                  <Badge variant="secondary">Secondary</Badge>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-2.5">
                  <div className="bg-blue-500 rounded-full h-2.5" style={{ width: '65%' }}></div>
                </div>
              </div>
            )}
            
            {/* Tertiary Device */}
            {onlineBehavior.deviceUsage?.tertiary && (
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(onlineBehavior.deviceUsage.tertiary)}
                    <span className="text-sm font-medium">{onlineBehavior.deviceUsage.tertiary}</span>
                  </div>
                  <Badge variant="outline">Tertiary</Badge>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-2.5">
                  <div className="bg-sky-400 rounded-full h-2.5" style={{ width: '35%' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      
      {/* Social Platforms Section with Spider Chart */}
      <SectionCard title="Social Platforms" icon={<Globe className="h-5 w-5" />}>
        <div className="space-y-4">
          {socialPlatformItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={socialPlatformItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {onlineBehavior.socialPlatforms && onlineBehavior.socialPlatforms.length > 0 ? (
              onlineBehavior.socialPlatforms.map((platform: {name: string; usageFrequency: string; engagementLevel: string; relevance: string}, index: number) => (
                <div key={index} className="bg-muted/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{platform.name}</h4>
                    <Badge variant={getBadgeVariant(platform.relevance)}>
                      {platform.relevance}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Usage: {platform.usageFrequency}</span>
                    <span>Engagement: {platform.engagementLevel}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-muted/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">No social platform data available</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      
      {/* Browsing Habits Section */}
      <SectionCard title="Browsing Habits" icon={<BarChart className="h-5 w-5" />}>
        <div className="space-y-4">
          {onlineBehavior.browsingHabits?.peakHours && onlineBehavior.browsingHabits.peakHours.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Peak Hours</h4>
              <div className="grid grid-cols-1 gap-4">
                {/* Clock-like visualization for peak hours - Improved implementation */}
                <div className="relative w-full max-w-[280px] h-[280px] mx-auto rounded-full bg-muted/30 border border-border/30 flex items-center justify-center">
                  {/* Clock center */}
                  <div className="absolute w-3 h-3 rounded-full bg-primary z-10"></div>
                  
                  {/* Clock hour markers */}
                  {[...Array(12)].map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute w-1 h-4 bg-muted-foreground/40"
                      style={{ 
                        top: '50%',
                        left: '50%',
                        transform: `rotate(${i * 30}deg) translate(0, -120px)`,
                        transformOrigin: 'bottom center'
                      }}
                    ></div>
                  ))}
                  
                  {/* Hour numbers */}
                  {[...Array(12)].map((_, i) => {
                    const hour = i === 0 ? 12 : i;
                    const angle = (i * 30) * (Math.PI / 180);
                    const radius = 110; // Distance from center
                    const x = Math.sin(angle) * radius;
                    const y = -Math.cos(angle) * radius;
                    
                    return (
                      <div 
                        key={i} 
                        className="absolute text-xs font-medium text-muted-foreground"
                        style={{ 
                          top: `calc(50% + ${y}px)`,
                          left: `calc(50% + ${x}px)`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {hour}
                      </div>
                    );
                  })}
                  
                  {/* AM/PM labels */}
                  <div className="absolute top-4 text-xs font-medium text-muted-foreground">12 AM</div>
                  <div className="absolute bottom-4 text-xs font-medium text-muted-foreground">12 PM</div>
                  <div className="absolute left-4 text-xs font-medium text-muted-foreground">9</div>
                  <div className="absolute right-4 text-xs font-medium text-muted-foreground">3</div>
                  
                  {/* Peak hour indicators */}
                  {onlineBehavior.browsingHabits.peakHours.map((hour: string, index: number) => {
                    // Parse different time formats
                    let hourNum = 0;
                    let minutes = 0;
                    let period = '';
                    
                    // Try to match different time formats
                    // Format: "Morning (6:00-9:00)"
                    const timeRangeMatch = hour.match(/\((\d+):(\d+)-\d+:\d+\)/);
                    // Format: "6:00 AM-9:00 AM"
                    const timeRangeWithPeriodMatch = hour.match(/(\d+):(\d+)\s*(AM|PM)/i);
                    // Format: "6:00"
                    const simpleTimeMatch = hour.match(/^(\d+):(\d+)$/);
                    
                    if (timeRangeMatch) {
                      hourNum = parseInt(timeRangeMatch[1]);
                      minutes = parseInt(timeRangeMatch[2]);
                      // Determine period based on description
                      period = hour.toLowerCase().includes('morning') ? 'AM' : 
                              hour.toLowerCase().includes('afternoon') ? 'PM' : 
                              hour.toLowerCase().includes('evening') ? 'PM' : '';
                    } else if (timeRangeWithPeriodMatch) {
                      hourNum = parseInt(timeRangeWithPeriodMatch[1]);
                      minutes = parseInt(timeRangeWithPeriodMatch[2]);
                      period = timeRangeWithPeriodMatch[3].toUpperCase();
                    } else if (simpleTimeMatch) {
                      hourNum = parseInt(simpleTimeMatch[1]);
                      minutes = parseInt(simpleTimeMatch[2]);
                      // Guess period based on hour
                      period = hourNum < 12 ? 'AM' : 'PM';
                    } else {
                      // Try to extract just the first number as hour
                      const numberMatch = hour.match(/(\d+)/);
                      if (numberMatch) {
                        hourNum = parseInt(numberMatch[1]);
                        // Guess period based on description
                        period = hour.toLowerCase().includes('morning') ? 'AM' : 
                                hour.toLowerCase().includes('afternoon') ? 'PM' : 
                                hour.toLowerCase().includes('evening') ? 'PM' : 
                                hourNum < 12 ? 'AM' : 'PM';
                      } else {
                        return null; // Can't parse this format
                      }
                    }
                    
                    // Convert to 24-hour format for angle calculation
                    let hour24 = hourNum;
                    if (period === 'PM' && hourNum < 12) hour24 += 12;
                    if (period === 'AM' && hourNum === 12) hour24 = 0;
                    
                    // Calculate angle (0 = 12 o'clock, 90 = 3 o'clock, etc.)
                    const angle = ((hour24 * 60 + minutes) / (12 * 60)) * 360;
                    const radian = (angle - 90) * (Math.PI / 180);
                    
                    // Calculate position
                    const radius = 90; // Slightly smaller than hour markers
                    const x = Math.cos(radian) * radius;
                    const y = Math.sin(radian) * radius;
                    
                    // Determine background color based on time of day
                    let bgColor = 'bg-primary';
                    if (period === 'AM') {
                      bgColor = 'bg-blue-500';
                    } else if (period === 'PM' && hourNum < 6) {
                      bgColor = 'bg-orange-500';
                    } else if (period === 'PM') {
                      bgColor = 'bg-indigo-500';
                    }
                    
                    return (
                      <div 
                        key={index}
                        className={`absolute w-8 h-8 ${bgColor} text-white rounded-full flex items-center justify-center text-xs font-medium z-20 shadow-md`}
                        style={{
                          top: `calc(50% + ${y}px)`,
                          left: `calc(50% + ${x}px)`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        title={hour}
                      >
                        {hourNum}
                        <span className="text-[8px] ml-0.5">{period}</span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-muted-foreground">Morning</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-xs text-muted-foreground">Afternoon</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                    <span className="text-xs text-muted-foreground">Evening</span>
                  </div>
                </div>
                
                {/* List of peak hours for clarity */}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {onlineBehavior.browsingHabits.peakHours.map((hour: string, index: number) => (
                    <Badge key={index} variant="outline" className="py-1.5 px-3">
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {hour}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {onlineBehavior.browsingHabits?.contentPreferences && onlineBehavior.browsingHabits.contentPreferences.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Content Preferences</h4>
              <div className="flex flex-wrap gap-2">
                {onlineBehavior.browsingHabits.contentPreferences.map((preference: string, index: number) => (
                  <Badge key={index} variant="outline">{preference}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Decision Factors Section with Spider Chart */}
      <SectionCard title="Decision Factors" icon={<CheckCircle2 className="h-5 w-5" />}>
        <div className="space-y-4">
          {decisionFactorItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={decisionFactorItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {purchasingBehavior.decisionFactors && purchasingBehavior.decisionFactors.length > 0 ? (
              purchasingBehavior.decisionFactors.map((factor: {name: string; importance: string; description: string}, index: number) => (
                <div key={index} className="bg-muted/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{factor.name}</h4>
                    <Badge variant={getBadgeVariant(factor.importance)}>
                      {factor.importance}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{factor.description}</p>
                </div>
              ))
            ) : (
              <div className="bg-muted/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">No decision factors data available</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      
      {/* Price Range Section */}
      <SectionCard title="Price Range" icon={<ShoppingCart className="h-5 w-5" />}>
        <div className="space-y-4">
          {/* Subscription pricing */}
          {purchasingBehavior.priceRange?.subscription && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Subscription Pricing</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">Monthly</h5>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Preference:</span>
                      <span>{purchasingBehavior.priceRange.subscription.monthly?.preference || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Optimal:</span>
                      <span>{purchasingBehavior.priceRange.subscription.monthly?.optimal || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">Annual</h5>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Preference:</span>
                      <span>{purchasingBehavior.priceRange.subscription.annual?.preference || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Optimal:</span>
                      <span>{purchasingBehavior.priceRange.subscription.annual?.optimal || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* One-time pricing */}
          {purchasingBehavior.priceRange?.oneTime && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-3">One-Time Purchase</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Preference:</span>
                  <span>{purchasingBehavior.priceRange.oneTime?.preference || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Optimal:</span>
                  <span>{purchasingBehavior.priceRange.oneTime?.optimal || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Purchase Frequency Section */}
      <SectionCard title="Purchase Frequency" icon={<CalendarIcon className="h-5 w-5" />}>
        {purchasingBehavior.purchaseFrequency && (
          <div className="space-y-3">
            {Object.entries(purchasingBehavior.purchaseFrequency).map(([key, value], index) => (
              <div key={index} className="bg-muted/20 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium capitalize">{key}</h4>
                  <Badge variant="outline">{value}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      
      {/* Content Consumption Section with Spider Chart */}
      <SectionCard title="Content Preferences" icon={<MessageSquare className="h-5 w-5" />}>
        <div className="space-y-4">
          {/* Spider Chart for Content Preferences */}
          {contentPreferenceItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={contentPreferenceItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          {/* Preferred Formats */}
          {contentConsumption.preferredFormats && contentConsumption.preferredFormats.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Preferred Formats</h4>
              <div className="space-y-3">
                {contentConsumption.preferredFormats.map((format: {type: string; preference: string; idealDuration?: string; idealLength?: string}, index: number) => (
                  <div key={index} className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <h5 className="text-sm font-medium">{format.type}</h5>
                      <Badge variant={getBadgeVariant(format.preference)}>
                        {format.preference}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format.idealDuration && <div>Ideal Duration: {format.idealDuration}</div>}
                      {format.idealLength && <div>Ideal Length: {format.idealLength}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Research Habits */}
          {contentConsumption.researchHabits && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Research Habits</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Depth:</span>
                  <span>{contentConsumption.researchHabits.depth || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Time Spent:</span>
                  <span>{contentConsumption.researchHabits.timeSpent || 'N/A'}</span>
                </div>
                {contentConsumption.researchHabits.sources && contentConsumption.researchHabits.sources.length > 0 && (
                  <div>
                    <span className="text-sm">Sources:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {contentConsumption.researchHabits.sources.map((source: string, index: number) => (
                        <Badge key={index} variant="outline">{source}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}; 