import { useState, useEffect } from "react"

// Konstanta untuk durasi
const MS_IN_SECOND = 1000
const MS_IN_MINUTE = 60 * MS_IN_SECOND
const MS_IN_HOUR = 60 * MS_IN_MINUTE
const MS_IN_DAY = 24 * MS_IN_HOUR
const MS_IN_MONTH = 30 * MS_IN_DAY
const MS_IN_YEAR = 365 * MS_IN_DAY

export default function CooldownTime({ dateScheduled }) {
    const [timeLeft, setTimeLeft] = useState(getTimeLeft(dateScheduled))

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(getTimeLeft(dateScheduled))
        }, 1000)

        return () => clearInterval(interval)
    }, [dateScheduled])

    if (timeLeft.total <= 0) {
        return <span>null</span>
    }

    const parts = []
    if (timeLeft.years) parts.push(`${timeLeft.years} Year${timeLeft.years > 1 ? "s" : ""}`)
    if (timeLeft.months) parts.push(`${timeLeft.months} Mon${timeLeft.months > 1 ? "s" : ""}`)
    if (timeLeft.days) parts.push(`${timeLeft.days} Day${timeLeft.days > 1 ? "s" : ""}`)
    if (timeLeft.hours) parts.push(`${timeLeft.hours} Hour${timeLeft.hours > 1 ? "s" : ""}`)
    if (timeLeft.minutes) parts.push(`${timeLeft.minutes} Min${timeLeft.minutes > 1 ? "s" : ""}`)
    parts.push(`${timeLeft.seconds} Sec${timeLeft.seconds > 1 ? "s" : ""}`)

    return <span>{parts.join(" ")}</span>
}

// Fungsi helper untuk hitung selisih waktu
function getTimeLeft(targetDate) {
    const total = targetDate ? new Date(targetDate) - new Date() : 0
    if (total <= 0) return { total: 0, seconds: 0 }

    let remainder = total

    const years = Math.floor(remainder / MS_IN_YEAR)
    remainder %= MS_IN_YEAR

    const months = Math.floor(remainder / MS_IN_MONTH)
    remainder %= MS_IN_MONTH

    const days = Math.floor(remainder / MS_IN_DAY)
    remainder %= MS_IN_DAY

    const hours = Math.floor(remainder / MS_IN_HOUR)
    remainder %= MS_IN_HOUR

    const minutes = Math.floor(remainder / MS_IN_MINUTE)
    remainder %= MS_IN_MINUTE

    const seconds = Math.floor(remainder / MS_IN_SECOND)

    return { total, years, months, days, hours, minutes, seconds }
}
