import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

export interface DayHours {
  day: string;
  isOpen: boolean;
  open: string;
  close: string;
}

interface OpeningHoursInputProps {
  value: DayHours[];
  onChange: (value: DayHours[]) => void;
}

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function OpeningHoursInput({ value, onChange }: OpeningHoursInputProps) {

  const handleTimeChange = (day: string, type: 'open' | 'close', time: string) => {
    const updatedHours = value.map(d => 
      d.day === day ? { ...d, [type]: time } : d
    );
    onChange(updatedHours);
  };

  const handleOpenToggle = (day: string, isOpen: boolean) => {
    const updatedHours = value.map(d => 
      d.day === day ? { ...d, isOpen } : d
    );
    onChange(updatedHours);
  };

  const applyToAll = (sourceDay: string) => {
    const source = value.find(d => d.day === sourceDay);
    if (!source) return;

    const updatedHours = value.map(d => {
      if (d.isOpen) { // Only apply to days that are marked as open
        return { ...d, open: source.open, close: source.close };
      }
      return d;
    });
    onChange(updatedHours);
  };

  return (
    <div className="space-y-4 p-4 border border-gray-700 rounded-xl bg-gray-900/50">
      <h4 className="text-lg font-semibold text-white">Opening Hours</h4>
      <div className="space-y-2">
        {daysOfWeek.map(day => {
          const dayData = value.find(d => d.day === day);
          if (!dayData) return null;

          return (
            <div key={day} className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 p-3 bg-gray-800/70 rounded-xl">
              <div className="flex items-center justify-between">
                <Checkbox
                  id={`is-open-${day}`}
                  checked={dayData.isOpen}
                  onCheckedChange={(checked) => handleOpenToggle(day, !!checked)}
                />
                <Label htmlFor={`is-open-${day}`} className="font-semibold text-white">{day}</Label>
              </div>

              <div className={`grid grid-cols-2 gap-3 transition-opacity duration-300 ${!dayData.isOpen ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="relative">
                  <Label htmlFor={`open-${day}`} className="absolute -top-2 left-2 text-xs text-gray-400 bg-gray-800/70 px-1">From</Label>
                  <Input
                    id={`open-${day}`}
                    type="time"
                    value={dayData.open}
                    onChange={(e) => handleTimeChange(day, 'open', e.target.value)}
                    disabled={!dayData.isOpen}
                    className="bg-gray-700 border-gray-600 rounded-xl"
                  />
                </div>
                <div className="relative">
                  <Label htmlFor={`close-${day}`} className="absolute -top-2 left-2 text-xs text-gray-400 bg-gray-800/70 px-1">To</Label>
                  <Input
                    id={`close-${day}`}
                    type="time"
                    value={dayData.close}
                    onChange={(e) => handleTimeChange(day, 'close', e.target.value)}
                    disabled={!dayData.isOpen}
                    className="bg-gray-700 border-gray-600 rounded-xl"
                  />
                </div>
              </div>

              <div className="md:ml-2 justify-self-end">
                {dayData.isOpen ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyToAll(day)}
                    title="Apply to all open days"
                    className="text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 rounded-xl"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Apply to all
                  </Button>
                ) : (
                  <div className="text-center text-red-400 font-semibold text-sm w-full md:w-auto">
                    Closed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}