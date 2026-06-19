export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'once'

export type PaymentMethod = 'cash' | 'transfer' | 'debt'

export type TaskStatus = 'pending' | 'done'

export type ExpenseCategory = 'fuel' | 'supplies' | 'parking' | 'other'

export type SpecialService = {
  id: string
  name: string
  price: number
}

export type Client = {
  id: string
  storeName: string
  address: string
  contactName: string
  phone: string
  price: number
  frequency: Frequency
}

export type ServiceTask = {
  id: string
  clientId: string
  scheduledDate: string
  status: TaskStatus
  paymentMethod: PaymentMethod | null
  specialServices?: SpecialService[]
  completedAt?: string
}

export type Expense = {
  id: string
  date: string
  category: ExpenseCategory
  amount: number
  note: string
}

export type AppDatabase = {
  clients: Client[]
  tasks: ServiceTask[]
  expenses: Expense[]
}
