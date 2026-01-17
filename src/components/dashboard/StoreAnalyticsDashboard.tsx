import React from 'react';
import { Doc } from '../../../convex/_generated/dataModel';
import { AnalyticsTabContent, AnalyticsData } from './AnalyticsTabContent';
import { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';

type StoreWithImageUrl = Doc<"stores"> & { imageUrl: string | null };

interface AnalyticsDashboardProps {
  store: StoreWithImageUrl;
  timeRange: '7d' | '30d';
  setTimeRange: (range: '7d' | '30d') => void;
  detailedAnalytics: FunctionReturnType<typeof api.analytics.getStoreAnalytics> | undefined | null;
}

export function StoreAnalyticsDashboard({ store, timeRange, setTimeRange, detailedAnalytics }: AnalyticsDashboardProps) {
  // Guard Clause: Prevent component from crashing if store data is not yet available.
  if (!store) {
    return <div>Loading dashboard...</div>; // Or a more sophisticated skeleton loader
  }

  return (
    <div className="space-y-6">
        {/* Main Content */}
        {/* The Tabs component has been moved to StoreManager. This component now only renders the analytics content. */}
        <AnalyticsTabContent
          analyticsData={detailedAnalytics as AnalyticsData | null | undefined} // Cast to the expected type
          isLoading={detailedAnalytics === undefined}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
    </div>
  );
}