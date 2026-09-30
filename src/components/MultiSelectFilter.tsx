import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  getLabel = (value) => value,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  getLabel?: (value: string) => string;
}) {
  const allSelected =
    options.length === selected.size && options.every((value) => selected.has(value));
  const summary = allSelected
    ? `All ${label.toLowerCase()}s`
    : `${selected.size} ${label.toLowerCase()}${selected.size === 1 ? "" : "s"}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="tap-target min-w-32 justify-between">
          <span>{summary}</span>
          <ListFilter className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.has(option)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(option);
              else next.delete(option);
              onChange(next);
            }}
          >
            {getLabel(option)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
