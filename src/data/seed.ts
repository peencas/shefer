import type { AppDatabase } from '../types'
import { addDays, todayKey } from '../lib/date'

const today = todayKey()

export const seedDatabase: AppDatabase = {
  clients: [
    {
      id: 'client-1',
      storeName: 'בוטיק החלונות',
      address: 'דיזנגוף 122, תל אביב',
      contactName: 'דנה לוי',
      phone: '050-1234567',
      price: 280,
      frequency: 'weekly',
    },
    {
      id: 'client-2',
      storeName: 'קפה שדרה',
      address: 'שדרות רוטשילד 48, תל אביב',
      contactName: 'אורי כהן',
      phone: '052-4455667',
      price: 180,
      frequency: 'biweekly',
    },
    {
      id: 'client-3',
      storeName: 'סטודיו אור',
      address: 'אבן גבירול 72, תל אביב',
      contactName: 'מאיה רוזן',
      phone: '054-7788990',
      price: 320,
      frequency: 'monthly',
    },
    {
      id: 'client-4',
      storeName: 'פרחי העיר',
      address: 'יהודה המכבי 31, תל אביב',
      contactName: 'רן מזרחי',
      phone: '053-2223344',
      price: 220,
      frequency: 'weekly',
    },
  ],
  tasks: [
    {
      id: 'task-1',
      clientId: 'client-1',
      scheduledDate: today,
      status: 'pending',
      paymentMethod: null,
    },
    {
      id: 'task-2',
      clientId: 'client-2',
      scheduledDate: today,
      status: 'pending',
      paymentMethod: null,
    },
    {
      id: 'task-3',
      clientId: 'client-3',
      scheduledDate: today,
      status: 'pending',
      paymentMethod: null,
    },
    {
      id: 'task-4',
      clientId: 'client-4',
      scheduledDate: addDays(today, 1),
      status: 'pending',
      paymentMethod: null,
    },
  ],
  expenses: [
    {
      id: 'expense-1',
      date: today,
      category: 'fuel',
      amount: 90,
      note: 'תדלוק בוקר',
    },
  ],
}
