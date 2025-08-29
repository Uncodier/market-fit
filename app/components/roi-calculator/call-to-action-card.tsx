import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Calendar, CheckCircle } from "@/app/components/ui/icons";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";

interface CallToActionCardProps {
  simulationValues: any;
  simulatedMetrics: any;
  handleGenerateAnalysis: () => void;
}

export function CallToActionCard({ 
  simulationValues, 
  simulatedMetrics, 
  handleGenerateAnalysis 
}: CallToActionCardProps) {
  return (
    <div className="mt-8 max-w-4xl mx-auto">
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">
            Ready to Unlock Your Growth Potential?
          </h3>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Based on your {Object.values(simulationValues).some(v => v !== 1.0) ? 'simulated scenario' : 'current analysis'}, you could potentially add{" "}
            <span className="font-bold text-white">
              {formatCurrency(simulatedMetrics.projectedRevenue - simulatedMetrics.filledKpis.monthlyRevenue * 12)}
            </span>{" "}
            in annual revenue. Let's discuss how to make this a reality.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-blue-600">
              📅 Book Free Strategy Call
            </Button>
            <Button 
              onClick={handleGenerateAnalysis}
              size="lg" 
              variant="secondary" 
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              ✅ Complete Analysis & Get Report
            </Button>
          </div>
          <div className="mt-4 text-sm text-blue-200">
            💡 Free 30-minute consultation • No commitment required • Instant calendar booking
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
