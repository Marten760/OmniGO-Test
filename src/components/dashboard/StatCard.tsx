import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface StatCardProps {
  title: string;
  value: string;
  description:string;
  icon: ReactNode;
  gradient: string;
}

export function StatCard({ title, value, description, icon, gradient }: StatCardProps) {
  return (
    <Card className={`border-0 bg-gradient-to-r ${gradient}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}