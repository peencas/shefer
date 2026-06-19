import { seedDatabase } from '../data/seed'
import type { AppDatabase, Client, Expense, PaymentMethod } from '../types'
import { getNextServiceDate, todayKey } from './date'

const STORAGE_KEY = 'shefer-cleaning-database-v1'

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export const loadDatabase = (): AppDatabase => {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDatabase))
    return seedDatabase
  }

  try {
    return JSON.parse(stored) as AppDatabase
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
      ...(alreadyScheduled
        ? []
        : [
            {
              id: createId('task'),
              clientId: client.id,
              scheduledDate: nextDate,
              status: 'pending' as const,
              paymentMethod: null,
            },
          ]),
    ],
  }
}

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
