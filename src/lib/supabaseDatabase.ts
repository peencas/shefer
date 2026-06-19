import type { AppDatabase, Client, Expense, ServiceTask, SpecialService } from '../types'
import { supabase } from './supabaseClient'

type ClientRow = {
  id: string
  store_name: string
  address: string
  contact_name: string
  phone: string
  price: number
  frequency: Client['frequency']
}

type TaskRow = {
  id: string
  client_id: string
  scheduled_date: string
  status: ServiceTask['status']
  payment_method: ServiceTask['paymentMethod']
  completed_at: string | null
}

type SpecialServiceRow = {
  id: string
  task_id: string
  name: string
  price: number
}

type ExpenseRow = {
  id: string
  expense_date: string
  category: Expense['category']
  amount: number
  note: string
}

type NoteRow = {
  id: string
  text: string
  client_id: string | null
  reminder_date: string
  is_done: boolean
  created_at: string
}

const deleteAllRows = async (tableName: string) => {
  if (!supabase) return
  await supabase.from(tableName).delete().neq('id', '__never__')
}

export const loadSupabaseDatabase = async (): Promise<AppDatabase | null> => {
  if (!supabase) return null

  const [clientsResult, tasksResult, specialServicesResult, expensesResult, notesResult] =
    await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('service_tasks').select('*'),
      supabase.from('special_services').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('reminder_notes').select('*'),
    ])

  if (
    clientsResult.error ||
    tasksResult.error ||
    specialServicesResult.error ||
    expensesResult.error ||
    notesResult.error
  ) {
    return null
  }

  const specialServicesByTask = new Map<string, SpecialService[]>()
  ;((specialServicesResult.data ?? []) as SpecialServiceRow[]).forEach((service) => {
    const existingServices = specialServicesByTask.get(service.task_id) ?? []
    existingServices.push({
      id: service.id,
      name: service.name,
      price: Number(service.price),
    })
    specialServicesByTask.set(service.task_id, existingServices)
  })

  return {
    clients: ((clientsResult.data ?? []) as ClientRow[]).map((client) => ({
      id: client.id,
      storeName: client.store_name,
      address: client.address,
      contactName: client.contact_name,
      phone: client.phone,
      price: Number(client.price),
      frequency: client.frequency,
    })),
    tasks: ((tasksResult.data ?? []) as TaskRow[]).map((task) => ({
      id: task.id,
      clientId: task.client_id,
      scheduledDate: task.scheduled_date,
      status: task.status,
      paymentMethod: task.payment_method,
      completedAt: task.completed_at ?? undefined,
      specialServices: specialServicesByTask.get(task.id) ?? [],
    })),
    expenses: ((expensesResult.data ?? []) as ExpenseRow[]).map((expense) => ({
      id: expense.id,
      date: expense.expense_date,
      category: expense.category,
      amount: Number(expense.amount),
      note: expense.note,
    })),
    notes: ((notesResult.data ?? []) as NoteRow[]).map((note) => ({
      id: note.id,
      text: note.text,
      clientId: note.client_id,
      reminderDate: note.reminder_date,
      isDone: note.is_done,
      createdAt: note.created_at,
    })),
  }
}

export const saveSupabaseDatabase = async (database: AppDatabase) => {
  if (!supabase) return

  await deleteAllRows('special_services')
  await deleteAllRows('reminder_notes')
  await deleteAllRows('service_tasks')
  await deleteAllRows('expenses')
  await deleteAllRows('clients')

  const clients: ClientRow[] = database.clients.map((client) => ({
    id: client.id,
    store_name: client.storeName,
    address: client.address,
    contact_name: client.contactName,
    phone: client.phone,
    price: client.price,
    frequency: client.frequency,
  }))

  const tasks: TaskRow[] = database.tasks.map((task) => ({
    id: task.id,
    client_id: task.clientId,
    scheduled_date: task.scheduledDate,
    status: task.status,
    payment_method: task.paymentMethod,
    completed_at: task.completedAt ?? null,
  }))

  const specialServices: SpecialServiceRow[] = database.tasks.flatMap((task) =>
    (task.specialServices ?? []).map((service) => ({
      id: service.id,
      task_id: task.id,
      name: service.name,
      price: service.price,
    })),
  )

  const expenses: ExpenseRow[] = database.expenses.map((expense) => ({
    id: expense.id,
    expense_date: expense.date,
    category: expense.category,
    amount: expense.amount,
    note: expense.note,
  }))

  const notes: NoteRow[] = database.notes.map((note) => ({
    id: note.id,
    text: note.text,
    client_id: note.clientId,
    reminder_date: note.reminderDate,
    is_done: note.isDone,
    created_at: note.createdAt,
  }))

  if (clients.length > 0) await supabase.from('clients').insert(clients)
  if (tasks.length > 0) await supabase.from('service_tasks').insert(tasks)
  if (specialServices.length > 0) await supabase.from('special_services').insert(specialServices)
  if (expenses.length > 0) await supabase.from('expenses').insert(expenses)
  if (notes.length > 0) await supabase.from('reminder_notes').insert(notes)
}
