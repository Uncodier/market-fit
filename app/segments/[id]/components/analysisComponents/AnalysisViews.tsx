import { Segment } from "../../page";
import { PerformanceMetricsComponent } from "./PerformanceMetricsComponent";
import { MarketPenetrationComponent } from "./MarketPenetrationComponent";
import { BehaviorComponent } from "./BehaviorComponent";
import { DemographicsComponent } from "./DemographicsComponent";
import { RegionalDistributionComponent } from "./RegionalDistributionComponent";
import { useTheme } from "@/app/context/ThemeContext";

interface AnalysisComponentProps {
  segment: Segment;
}

export function OverviewAnalysis({ segment }: AnalysisComponentProps) {
  const { isDarkMode } = useTheme();

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      <PerformanceMetricsComponent 
        isDarkMode={isDarkMode}
        segmentId={segment.id}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Penetration Card */}
        <MarketPenetrationComponent 
          segment={segment}
          selectedAdPlatform="googleAds"
        />

        {/* Behavior Card */}
        <BehaviorComponent 
          segment={segment}
          selectedAdPlatform="googleAds"
          copyStates={{ interests: false, demographics: false, behavior: false, regional: false }}
          copyToClipboard={async () => {}}
        />
      </div>
    </div>
  );
}

export function DemographicsAnalysis({ segment }: AnalysisComponentProps) {
  const { isDarkMode } = useTheme();

  return (
    <div className="space-y-6">
      <DemographicsComponent 
        segment={segment}
        selectedAdPlatform="googleAds"
        copyStates={{ interests: false, demographics: false, behavior: false, regional: false }}
        copyToClipboard={async () => {}}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export function InterestsAnalysis({ segment }: AnalysisComponentProps) {
  return (
    <div className="space-y-6">
      <MarketPenetrationComponent 
        segment={segment}
        selectedAdPlatform="googleAds"
      />
    </div>
  );
}

export function BehaviorAnalysis({ segment }: AnalysisComponentProps) {
  return (
    <div className="space-y-6">
      <BehaviorComponent 
        segment={segment}
        selectedAdPlatform="googleAds"
        copyStates={{ interests: false, demographics: false, behavior: false, regional: false }}
        copyToClipboard={async () => {}}
      />
    </div>
  );
} 