import type { Frequency } from '../types'

export const toDateKey = (date: Date) => date.toISOString().slice(0, 10)

export const todayKey = () => toDateKey(new Date())

export const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export const getNextServiceDate = (dateKey: string, frequency: Frequency) => {
  if (frequency === 'once') return dateKey
  if (frequency === 'weekly') return addDays(dateKey, 7)
  if (frequency === 'biweekly') return addDays(dateKey, 14)

  const date = new Date(`${dateKey}T12:00:00`)
  date.setMonth(date.getMonth() + 1)
  return toDateKey(date)
}

export const formatHebrewDate = (dateKey: string) =>
  new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`))

export const formatShortDate = (dateKey: string) =>
  new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateKey}T12:00:00`))

export const isSameMonth = (dateKey: string, monthDate: Date) => {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.getMonth() === monthDate.getMonth() && date.getFullYear() === monthDate.getFullYear()
}
