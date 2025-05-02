import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface ActiveUsersWidgetProps {
  title?: string;
  subtitle?: string;
  className?: string;
  siteId?: string;
  selectedSegmentId?: string;
  selectedStartDate?: Date;
  selectedEndDate?: Date;
  skipKpiCreation?: boolean;
  useDemoData?: boolean;
}

export const ActiveUsersWidget = ({
  title = "Active Users",
  subtitle = "Total number of active users across your platform",
  className,
  siteId,
  selectedSegmentId,
  selectedStartDate,
  selectedEndDate,
  skipKpiCreation,
  useDemoData = false
}: ActiveUsersWidgetProps) => {
  const authUser = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!authUser) {
        console.log("[ActiveUsersWidget] No auth user, skipping data fetch");
        return;
      }

      if (!siteId) {
        console.log("[ActiveUsersWidget] No site ID, skipping data fetch");
        return;
      }

      setLoading(true);

      try {
        // Build URL with query parameters
        const params = new URLSearchParams();
        params.append("siteId", siteId);
        params.append("userId", authUser.id);
        
        if (selectedSegmentId && selectedSegmentId !== "all") {
          params.append("segmentId", selectedSegmentId);
        }
        
        if (selectedStartDate) {
          params.append("startDate", selectedStartDate.toISOString());
        }
        
        if (selectedEndDate) {
          params.append("endDate", selectedEndDate.toISOString());
        }

        if (skipKpiCreation) {
          params.append("skipKpiCreation", "true");
        }
        
        // Pasar el parámetro useDemoData a la API
        if (useDemoData) {
          params.append("useDemoData", "true");
        }

        const response = await fetch(`/api/active-users?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (isMounted) {
          const result = await response.json();
          setData(result);
          setLoading(false);
        }
      } catch (error) {
        console.error("[ActiveUsersWidget] Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [authUser, siteId, selectedSegmentId, selectedStartDate, selectedEndDate, skipKpiCreation, useDemoData]);

  return (
    <div className={`${className} active-users-widget`}>
      {/* Render your component content here */}
    </div>
  );
}; 