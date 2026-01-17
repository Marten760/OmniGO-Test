import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';

// This is the old, incorrect interface. We will now use the inferred type.
// export interface RevenueTrend {
//   day: string;
//   revenue: number;
// }
// 
// export interface CustomerInsights {
//   peakHours: string;
//   avgOrderValue: number;
//   repeatCustomerRate: number;
//   mostPopularItem: string;
// }
// 
// export interface AnalyticsData {
//   revenueTrends: RevenueTrend[];
//   customerInsights: CustomerInsights;
// }

export type AnalyticsData = FunctionReturnType<typeof api.analytics.getStoreAnalytics>;

interface AnalyticsTabContentProps {
  analyticsData?: AnalyticsData | null;
  isLoading: boolean;
  timeRange: '7d' | '30d';
  onTimeRangeChange: (range: '7d' | '30d') => void;
}

export function AnalyticsTabContent({ analyticsData, isLoading, timeRange, onTimeRangeChange }: AnalyticsTabContentProps) {
  if (isLoading) {
    return <AnalyticsTabSkeleton />;
  }

  if (!analyticsData) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-400">No analytics data available.</p>
        </CardContent>
      </Card>
    );
  }

  // Correctly access the data based on the backend structure
  const revenueTrends = Array.isArray(analyticsData.revenueByDay) ? analyticsData.revenueByDay : [];
  const overview = analyticsData.overview;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center gap-1 bg-gray-800/70 p-1 rounded-lg">
          <Button variant={timeRange === '7d' ? 'secondary' : 'ghost'} size="sm" onClick={() => onTimeRangeChange('7d')} data-active={timeRange === '7d'} className="rounded-md data-[active=true]:bg-purple-600 data-[active=true]:text-white transition-transform hover:scale-105">Last 7 Days</Button>
          <Button variant={timeRange === '30d' ? 'secondary' : 'ghost'} size="sm" onClick={() => onTimeRangeChange('30d')} data-active={timeRange === '30d'} className="rounded-md data-[active=true]:bg-purple-600 data-[active=true]:text-white transition-transform hover:scale-105">Last 30 Days</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle>Revenue Trends</CardTitle>
          <CardDescription>Daily revenue for the last {timeRange === '7d' ? '7' : '30'} days</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
            {revenueTrends.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-center text-gray-500">
                No revenue data for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrends} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(dateStr) => {
                      const date = new Date(dateStr);
                      // Adjust date for timezone offset to prevent day shifts
                      const adjustedDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
                      if (timeRange === '7d') return adjustedDate.toLocaleDateString(undefined, { weekday: 'short' });
                      return String(adjustedDate.getDate());
                    }}
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `π${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem' }} 
                    labelStyle={{ color: '#d1d5db' }}
                    formatter={(value: number) => [`π${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Legend wrapperStyle={{ fontSize: '14px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
        </CardContent>
      </Card>
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
          <CardDescription>Popular ordering times and behaviors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Total Revenue</span>
              <span className="font-medium">π{(overview?.totalRevenue ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Avg. Order Value</span>
              <span className="font-medium">π{(overview?.averageOrderValue ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Returning Customers</span>
              <span className="font-medium">{overview?.returningCustomers ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Top Product</span>
              <span className="font-medium">{analyticsData.topProducts?.[0]?.name ?? 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}

const AnalyticsTabSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-1/2 bg-gray-700" />
        <Skeleton className="h-4 w-3/4 bg-gray-700" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-10 bg-gray-700" />
            <div className="flex items-center gap-2 flex-1 mx-4">
              <Skeleton className="h-4 flex-1 bg-gray-700" />
              <Skeleton className="h-4 w-20 bg-gray-700" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-1/2 bg-gray-700" />
        <Skeleton className="h-4 w-3/4 bg-gray-700" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 bg-gray-700" />
            <Skeleton className="h-4 w-1/4 bg-gray-700" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 bg-gray-700" />
            <Skeleton className="h-4 w-1/4 bg-gray-700" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 bg-gray-700" />
            <Skeleton className="h-4 w-1/4 bg-gray-700" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 bg-gray-700" />
            <Skeleton className="h-4 w-1/4 bg-gray-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);