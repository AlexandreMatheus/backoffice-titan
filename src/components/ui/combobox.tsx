"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface ComboboxOption {
  value: string
  label: string
  color?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  selectedValues: string[]
  onSelect: (value: string) => void
  onRemove: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  badgeColor?: string
}

export function Combobox({
  options,
  selectedValues,
  onSelect,
  onRemove,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  className,
  badgeColor,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filteredOptions = React.useMemo(() => {
    if (!search) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    )
  }, [options, search])

  const selectedOptions = React.useMemo(() => {
    return options.filter((option) => selectedValues.includes(option.value))
  }, [options, selectedValues])

  const handleSelect = (value: string) => {
    if (selectedValues.includes(value)) {
      onRemove(value)
    } else {
      onSelect(value)
    }
    setSearch("")
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-10 h-auto py-2"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedOptions.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedOptions.map((option) => {
                  const displayColor = badgeColor || option.color
                  return (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="mr-1"
                      style={{
                        backgroundColor: displayColor
                          ? `${displayColor}20`
                          : undefined,
                        color: displayColor || undefined,
                        borderColor: displayColor || undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(option.value)
                      }}
                    >
                      {option.label}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  )
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 !max-h-[500px] !flex !flex-col"
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="p-2 !flex-shrink-0">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="!overflow-y-auto !flex-1" onWheel={(e) => e.stopPropagation()}>

            {filteredOptions.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              <div className="p-1">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value)
                  return (
                    <div
                      key={option.value}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent"
                      )}
                      onClick={() => handleSelect(option.value)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: option.color || "#3B82F6" }}
                        />
                        <span className="flex-1">{option.label}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

