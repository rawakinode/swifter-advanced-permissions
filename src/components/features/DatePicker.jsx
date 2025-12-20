import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Calendar1Icon } from "lucide-react"
import { format } from "date-fns"

export default function DateTimePicker({ value, onChange }) {
  const [time, setTime] = useState("12:00")
  const [open, setOpen] = useState(false)

  // Sync time input dengan value dari parent
  useEffect(() => {
    if (value) {
      const h = value.getHours().toString().padStart(2, "0")
      const m = value.getMinutes().toString().padStart(2, "0")
      setTime(`${h}:${m}`)
    }
  }, [value])

  const handleSelect = (selectedDate) => {
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number)
      selectedDate.setHours(hours)
      selectedDate.setMinutes(minutes)
      onChange?.(new Date(selectedDate))
    }
  }

  const handleTimeChange = (e) => {
    setTime(e.target.value)
    if (value) {
      const newDate = new Date(value)
      const [h, m] = e.target.value.split(":").map(Number)
      newDate.setHours(h)
      newDate.setMinutes(m)
      onChange?.(newDate)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-xs text-left font-normal"
        >
            <Calendar1Icon className="w-4 h-4" />
          {value ? format(value, "yyyy-MM-dd HH:mm") : "Pilih tanggal & jam"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          initialFocus
          className="text-xs rounded-md w-[280px]"
        />
        <div className="flex items-center justify-between gap-2">
          <input
            type="time"
            value={time}
            onChange={handleTimeChange}
            className="text-sm border rounded-md px-2 py-1 w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
