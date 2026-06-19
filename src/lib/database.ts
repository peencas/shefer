import { seedDatabase } from '../data/seed'
import type { AppDatabase, Client, Expense, PaymentMethod } from '../types'
import { getNextServiceDate, todayKey } from './date'

const STORAGE_KEY = 'shefer-cleaning-database-v1'
const LEGACY_DEMO_CLIENT_IDS = new Set(['client-1', 'client-2', 'client-3', 'client-4'])
const LEGACY_DEMO_TASK_IDS = new Set(['task-1', 'task-2', 'task-3', 'task-4'])
const LEGACY_DEMO_EXPENSE_IDS = new Set(['expense-1'])

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const removeLegacyDemoData = (database: AppDatabase): AppDatabase => ({
  ...database,
  clients: database.clients.filter((client) => !LEGACY_DEMO_CLIENT_IDS.has(client.id)),
  tasks: database.tasks.filter(
    (task) => !LEGACY_DEMO_TASK_IDS.has(task.id) && !LEGACY_DEMO_CLIENT_IDS.has(task.clientId),
  ),
  expenses: database.expenses.filter((expense) => !LEGACY_DEMO_EXPENSE_IDS.has(expense.id)),
})

export const loadDatabase = (): AppDatabase => {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase))
    return seedDatabase
  }

  try {
    const database = removeLegacyDemoData(JSON.parse(stored) as AppDatabase)
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
      {
        id: createId('task'),
        clientId: newClient.id,
        scheduledDate: firstServiceDate,
        status: 'pending',
        paymentMethod: null,
        specialServices: [],
      },
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

  const client = database.clients.find((item) => item.id === task.clientId)
  if (!client) return database

  const shouldScheduleNextTask = client.frequency !== 'once'
  const nextDate = getNextServiceDate(task.scheduledDate, client.frequency)
  const alreadyScheduled = database.tasks.some(
    (item) =>
      item.clientId === client.id &&
      item.scheduledDate === nextDate &&
      item.status === 'pending',
  )

  return {
    ...database,
    tasks: [
      ...database.tasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: 'done' as const,
              paymentMethod,
              completedAt: new Date().toISOString(),
            }
          : item,
      ),
      ...(!shouldScheduleNextTask || alreadyScheduled
        ? []
        : [
            {
              id: createId('task'),
              clientId: client.id,
              scheduledDate: nextDate,
              status: 'pending' as const,
              paymentMethod: null,
              specialServices: [],
            },
          ]),
    ],
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
