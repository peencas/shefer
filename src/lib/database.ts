import { seedDatabase } from '../data/seed'
import type { AppDatabase, Client, Expense, PaymentMethod } from '../types'
import { addDays, getNextServiceDate, todayKey } from './date'

const STORAGE_KEY = 'shefer-cleaning-database-v1'
const LEGACY_DEMO_CLIENT_IDS = new Set(['client-1', 'client-2', 'client-3', 'client-4'])
const LEGACY_DEMO_TASK_IDS = new Set(['task-1', 'task-2', 'task-3', 'task-4'])
const LEGACY_DEMO_EXPENSE_IDS = new Set(['expense-1'])

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const createPendingTask = (clientId: string, scheduledDate: string) => ({
  id: createId('task'),
  clientId,
  scheduledDate,
  status: 'pending' as const,
  paymentMethod: null,
  specialServices: [],
})

const getRecurringDates = (startDate: string, frequency: Client['frequency']) => {
  if (frequency === 'once') return [startDate]

  const horizonDate = addDays(todayKey(), 370)
  const dates = [startDate]
  let nextDate = getNextServiceDate(startDate, frequency)

  while (nextDate <= horizonDate) {
    dates.push(nextDate)
    nextDate = getNextServiceDate(nextDate, frequency)
  }

  return dates
}

const removeLegacyDemoData = (database: AppDatabase): AppDatabase => ({
  ...database,
  clients: database.clients.filter((client) => !LEGACY_DEMO_CLIENT_IDS.has(client.id)),
  tasks: database.tasks.filter(
    (task) => !LEGACY_DEMO_TASK_IDS.has(task.id) && !LEGACY_DEMO_CLIENT_IDS.has(task.clientId),
  ),
  expenses: database.expenses.filter((expense) => !LEGACY_DEMO_EXPENSE_IDS.has(expense.id)),
})

const ensureRecurringTasks = (database: AppDatabase): AppDatabase => {
  const tasksToAdd = database.clients.flatMap((client) => {
    const clientTasks = database.tasks.filter((task) => task.clientId === client.id)
    const existingDates = new Set(clientTasks.map((task) => task.scheduledDate))
    const latestExistingDate = clientTasks
      .map((task) => task.scheduledDate)
      .sort((a, b) => b.localeCompare(a))[0]
    const startDate = latestExistingDate ?? todayKey()

    return getRecurringDates(startDate, client.frequency)
      .filter((date) => !existingDates.has(date))
      .map((date) => createPendingTask(client.id, date))
  })

  if (tasksToAdd.length === 0) return database

  return {
    ...database,
    tasks: [...database.tasks, ...tasksToAdd],
  }
}

export const loadDatabase = (): AppDatabase => {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase))
    return seedDatabase
  }

  try {
    const database = ensureRecurringTasks(removeLegacyDemoData(JSON.parse(stored) as AppDatabase))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
    return database
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase))
    return seedDatabase
  }
}

export const saveDatabase = (database: AppDatabase) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

export const addClientToDatabase = (
  database: AppDatabase,
  client: Omit<Client, 'id'>,
  firstServiceDate = todayKey(),
): AppDatabase => {
  const newClient: Client = {
    ...client,
    id: createId('client'),
  }

  return {
    ...database,
    clients: [...database.clients, newClient],
    tasks: [
      ...database.tasks,
      ...getRecurringDates(firstServiceDate, newClient.frequency).map((date) =>
        createPendingTask(newClient.id, date),
      ),
    ],
  }
}

export const deleteClientFromDatabase = (
  database: AppDatabase,
  clientId: string,
): AppDatabase => ({
  ...database,
  clients: database.clients.filter((client) => client.id !== clientId),
  tasks: database.tasks.filter((task) => task.clientId !== clientId),
})

export const completeTaskInDatabase = (
  database: AppDatabase,
  taskId: string,
  paymentMethod: PaymentMethod,
): AppDatabase => {
  const task = database.tasks.find((item) => item.id === taskId)
  if (!task) return database

  return {
    ...database,
    tasks: database.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            status: 'done' as const,
            paymentMethod,
            completedAt: new Date().toISOString(),
          }
        : item,
    ),
  }
}

export const addSpecialServiceToTaskInDatabase = (
  database: AppDatabase,
  taskId: string,
  service: { name: string; price: number },
): AppDatabase => ({
  ...database,
  tasks: database.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          specialServices: [
            ...(task.specialServices ?? []),
            { ...service, id: createId('special-service') },
          ],
        }
      : task,
  ),
})

export const moveTaskInDatabase = (
  database: AppDatabase,
  taskId: string,
  scheduledDate: string,
): AppDatabase => ({
  ...database,
  tasks: database.tasks.map((task) =>
    task.id === taskId && task.status === 'pending' ? { ...task, scheduledDate } : task,
  ),
})

export const addExpenseToDatabase = (
  database: AppDatabase,
  expense: Omit<Expense, 'id'>,
): AppDatabase => ({
  ...database,
  expenses: [...database.expenses, { ...expense, id: createId('expense') }],
})
