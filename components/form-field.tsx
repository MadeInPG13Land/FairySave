'use client';

import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BaseFieldProps {
  label: string;
  description?: string;
  className?: string;
}

interface TextFieldProps extends BaseFieldProps {
  type: 'text';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface NumberFieldProps extends BaseFieldProps {
  type: 'number';
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

interface ToggleFieldProps extends BaseFieldProps {
  type: 'toggle';
  value: boolean;
  onChange: (value: boolean) => void;
}

interface SelectFieldProps extends BaseFieldProps {
  type: 'select';
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string | number; label: ReactNode }[];
  showIndicator?: boolean;
  itemTone?: 'accent' | 'neutral';
  spacedItems?: boolean;
}

type FormFieldProps = TextFieldProps | NumberFieldProps | ToggleFieldProps | SelectFieldProps;

function clampNumber(value: number, min?: number, max?: number) {
  const lowerBound = min ?? -Infinity;
  const upperBound = max ?? Infinity;
  return Math.min(upperBound, Math.max(lowerBound, value));
}

export function FormField(props: FormFieldProps) {
  const { label, description, className } = props;

  if (props.type === 'toggle') {
    return (
      <div className={cn("flex items-center justify-between gap-4 py-2", className)}>
        <div>
          <Label className="text-sm text-foreground">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <Switch 
          checked={props.value} 
          onCheckedChange={props.onChange}
          className="data-[state=checked]:bg-primary"
        />
      </div>
    );
  }

  if (props.type === 'number') {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label className="text-sm text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => props.onChange(clampNumber(props.value - (props.step ?? 1), props.min, props.max))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <div className="flex min-w-0 flex-1 items-stretch">
            <Input 
              type="number"
              value={props.value}
              onChange={(e) => props.onChange(clampNumber(Number(e.target.value), props.min, props.max))}
              min={props.min}
              max={props.max}
              step={props.step}
              className={cn(
                "bg-input border-border text-center font-mono focus-visible:border-primary/30 focus-visible:ring-primary/20 focus-visible:ring-[3px]",
                props.suffix ? "rounded-r-none border-r-0" : ""
              )}
            />
            {props.suffix ? (
              <div className="inline-flex items-center rounded-r-md border border-border bg-black/20 px-3 text-sm font-medium text-muted-foreground">
                {props.suffix}
              </div>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => props.onChange(clampNumber(props.value + (props.step ?? 1), props.min, props.max))}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (props.type === 'select') {
    const selectedOption = props.options.find((option) => String(option.value) === String(props.value));

    return (
      <div className={cn("space-y-1.5", className)}>
        <Label className="text-sm text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Select value={String(props.value)} onValueChange={props.onChange}>
          <SelectTrigger className="w-full bg-input border-border focus:border-primary/30 focus:ring-primary/20 focus:ring-[3px]">
            <span className="flex min-w-0 items-center gap-2 truncate">{selectedOption?.label}</span>
          </SelectTrigger>
          <SelectContent viewportClassName={props.spacedItems ? 'p-2' : undefined}>
            {props.options.map((option) => (
              <SelectItem
                key={option.value}
                value={String(option.value)}
                showIndicator={props.showIndicator}
                itemTone={props.itemTone}
                spaced={props.spacedItems}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Text field
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm text-foreground">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <Input 
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="bg-input border-border focus-visible:border-primary/30 focus-visible:ring-primary/20 focus-visible:ring-[3px]"
      />
    </div>
  );
}
