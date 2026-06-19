import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  PlusCircle,
  ReceiptText,
  StickyNote,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import {
  addClientToDatabase,
  addExpenseToDatabase,
  addNoteToDatabase,
  addSpecialServiceToTaskInDatabase,
  completeTaskInDatabase,
  deleteClientFromDatabase,
  deleteNoteFromDatabase,
  loadDatabase,
  moveTaskInDatabase,
  saveDatabase,
  toggleNoteInDatabase,
} from './lib/database'
import {
  addDays,
  formatHebrewDate,
  formatShortDate,
  isSameMonth,
  todayKey,
  toDateKey,
} from './lib/date'
import { loadSupabaseDatabase, saveSupabaseDatabase } from './lib/supabaseDatabase'
import { isSupabaseConfigured } from './lib/supabaseClient'
import type {
  AppDatabase,
  Client,
  ExpenseCategory,
  Frequency,
  PaymentMethod,
  ReminderNote,
  ServiceTask,
} from './types'

type Page = 'dashboard' | 'calendar' | 'client' | 'payments' | 'notes' | 'finance'

type TaskWithClient = {
  task: ServiceTask
  client: Client
}

const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

const frequencyLabels: Record<Frequency, string> = {
  weekly: 'כל שבוע',
  biweekly: 'כל שבועיים',
  monthly: 'פעם בחודש',
  once: 'חד פעמי',
}

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'מזומן',
  transfer: 'ביט / העברה',
  debt: 'חוב - לא שולם',
}

const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  fuel: 'דלק',
  supplies: 'חומרי ניקוי',
  parking: 'חנייה',
  other: 'אחר',
}

const pageMeta = {
  dashboard: { label: 'בית', icon: Home },
  calendar: { label: 'יומן', icon: Calendar },
  client: { label: 'לקוח', icon: PlusCircle },
  payments: { label: 'תשלומים', icon: ReceiptText },
  notes: { label: 'הערות', icon: StickyNote },
  finance: { label: 'כספים', icon: Wallet },
} satisfies Record<Page, { label: string; icon: typeof Home }>

const getPhoneLink = (phone: string) => phone.replace(/\D/g, '')

const getClient = (clients: Client[], clientId: string) =>
  clients.find((client) => client.id === clientId)

const getTaskTotal = ({ task, client }: TaskWithClient) =>
  client.price + (task.specialServices ?? []).reduce((sum, service) => sum + service.price, 0)

function App() {
  const [database, setDatabase] = useState<AppDatabase>(() => loadDatabase())
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [paymentTask, setPaymentTask] = useState<TaskWithClient | null>(null)
  const [specialServiceTask, setSpecialServiceTask] = useState<TaskWithClient | null>(null)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [dismissedYesterdayReminder, setDismissedYesterdayReminder] = useState(false)
  const [remoteDatabaseReady, setRemoteDatabaseReady] = useState(!isSupabaseConfigured())

  useEffect(() => {
    saveDatabase(database)
    if (remoteDatabaseReady && isSupabaseConfigured()) {
      void saveSupabaseDatabase(database)
    }
  }, [database, remoteDatabaseReady])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    let isMounted = true

    loadSupabaseDatabase()
      .then((remoteDatabase) => {
        if (remoteDatabase && isMounted) {
          setDatabase(remoteDatabase)
        }
      })
      .finally(() => {
        if (isMounted) setRemoteDatabaseReady(true)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowSplash(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const tasksWithClients = useMemo(
    () =>
      database.tasks
        .map((task) => {
          const client = getClient(database.clients, task.clientId)
          return client ? { task, client } : null
        })
        .filter((item): item is TaskWithClient => Boolean(item)),
    [database.clients, database.tasks],
  )

  const yesterdayOpenTasks = useMemo(
    () =>
      tasksWithClients.filter(
        ({ task }) => task.scheduledDate === addDays(todayKey(), -1) && task.status === 'pending',
      ),
    [tasksWithClients],
  )

  const completeTask = (taskId: string, paymentMethod: PaymentMethod) => {
    setDatabase((current) => completeTaskInDatabase(current, taskId, paymentMethod))
    setPaymentTask(null)
  }

  const moveTask = (taskId: string, scheduledDate: string) => {
    setDatabase((current) => moveTaskInDatabase(current, taskId, scheduledDate))
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_18%_0%,#ffffff_0%,#dff7fc_28%,#ecfbff_54%,#f8fdff_100%)] text-slate-950">
      <div className="pointer-events-none fixed -right-24 top-10 h-72 w-72 rounded-full bg-cyan-300/34 blur-3xl" />
      <div className="pointer-events-none fixed -left-24 top-80 h-80 w-80 rounded-full bg-sky-200/55 blur-3xl" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-56 bg-gradient-to-t from-white/75 to-transparent" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 pb-28 pt-4 sm:px-6">
        <AppHeader />

        <div className="flex-1">
          {activePage === 'dashboard' && (
            <DashboardPage
              tasks={tasksWithClients}
              onOpenPayment={setPaymentTask}
              onOpenSpecialService={setSpecialServiceTask}
            />
          )}

          {activePage === 'calendar' && (
            <CalendarPage tasks={tasksWithClients} onMoveTask={moveTask} />
          )}

          {activePage === 'client' && (
            <ClientPage
              clients={database.clients}
              onAddClient={(client, firstServiceDate) =>
                setDatabase((current) => addClientToDatabase(current, client, firstServiceDate))
              }
              onDeleteClient={(clientId) =>
                setDatabase((current) => deleteClientFromDatabase(current, clientId))
              }
            />
          )}

          {activePage === 'payments' && <PaymentsPage tasks={tasksWithClients} />}

          {activePage === 'notes' && (
            <NotesPage
              clients={database.clients}
              notes={database.notes}
              onAddNote={(note) =>
                setDatabase((current) => addNoteToDatabase(current, note))
              }
              onToggleNote={(noteId) =>
                setDatabase((current) => toggleNoteInDatabase(current, noteId))
              }
              onDeleteNote={(noteId) =>
                setDatabase((current) => deleteNoteFromDatabase(current, noteId))
              }
            />
          )}

          {activePage === 'finance' && (
            <FinancePage
              expenses={database.expenses}
              tasks={tasksWithClients}
              onOpenExpense={() => setExpenseModalOpen(true)}
            />
          )}
        </div>
      </div>

      <BottomNavigation activePage={activePage} onChange={setActivePage} />

      {!dismissedYesterdayReminder && yesterdayOpenTasks.length > 0 && (
        <YesterdayReminder
          tasks={yesterdayOpenTasks}
          onClose={() => setDismissedYesterdayReminder(true)}
        />
      )}

      {paymentTask && (
        <PaymentModal
          task={paymentTask}
          onClose={() => setPaymentTask(null)}
          onPay={(method) => completeTask(paymentTask.task.id, method)}
        />
      )}

      {expenseModalOpen && (
        <ExpenseModal
          onClose={() => setExpenseModalOpen(false)}
          onAddExpense={(expense) => {
            setDatabase((current) => addExpenseToDatabase(current, expense))
            setExpenseModalOpen(false)
          }}
        />
      )}

      {specialServiceTask && (
        <SpecialServiceModal
          task={specialServiceTask}
          onClose={() => setSpecialServiceTask(null)}
          onAddService={(service) => {
            setDatabase((current) =>
              addSpecialServiceToTaskInDatabase(current, specialServiceTask.task.id, service),
            )
            setSpecialServiceTask(null)
          }}
        />
      )}

      {showSplash && <OpeningSplash />}
    </main>
  )
}

function OpeningSplash() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff_0%,#dff7fc_42%,#f8fdff_100%)] p-6">
      <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-24 h-80 w-80 rounded-full bg-sky-200/60 blur-3xl" />

      <div className="glass-panel w-full max-w-md rounded-[2.25rem] p-6 text-center">
        <div className="glass-content">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.5rem] border border-cyan-100/80 bg-white/86 shadow-[0_14px_34px_rgba(10,132,170,0.14)]">
            <img
              src="/shefer-logo.png"
              alt="לוגו ש.פ.ר"
              className="h-48 w-40 object-cover object-center"
            />
          </div>
          <div className="rounded-[1.75rem] border border-white/75 bg-white/62 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_16px_40px_rgba(10,132,170,0.10)] backdrop-blur">
            <p className="text-4xl font-black leading-none text-cyan-500/40">״</p>
            <p className="blessing-text mx-auto max-w-xs text-[1.7rem] font-black leading-[1.65] text-slate-950">
              וזכרת את השם אלוהיך
              <span className="mx-auto my-3 block h-px w-20 bg-gradient-to-l from-transparent via-cyan-400/80 to-transparent" />
              כי הוא הנותן לך כח לעשות חייל
            </p>
            <p className="mt-1 text-4xl font-black leading-none text-cyan-500/40">״</p>
          </div>
          <div className="mx-auto mt-6 h-1 w-28 overflow-hidden rounded-full bg-cyan-100">
            <div className="h-full w-full animate-[splashProgress_3s_linear_forwards] rounded-full aqua-gradient" />
          </div>
        </div>
      </div>
    </div>
  )
}

function AppHeader() {
  return (
    <header className="glass-panel mb-5 rounded-[2.25rem] p-4">
      <div className="glass-content">
        <div className="mb-5 rounded-[1.75rem] border border-white/70 bg-white/42 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-cyan-100/80 bg-white/82 shadow-[0_14px_34px_rgba(10,132,170,0.14)]">
              <img
                src="/shefer-logo.png"
                alt="לוגו ש.פ.ר שירותי פרימיום לעסקים"
                className="h-48 w-40 object-cover object-center"
              />
            </div>
            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">
                Premium Glass Care
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                ש.פ.ר ניקיון ואחזקה
              </h1>
              <p className="mt-1 text-sm font-bold text-slate-500">שירותי פרימיום לעסקים</p>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">החמ"ל היומי</p>
            <p className="text-xl font-extrabold text-slate-950">
              {formatHebrewDate(todayKey())}
            </p>
          </div>
          <div className="rounded-full border border-cyan-200/80 bg-cyan-50/75 px-4 py-2 text-sm font-bold text-cyan-800 shadow-sm">
            זכוכית נקייה
          </div>
        </div>
      </div>
    </header>
  )
}

function YesterdayReminder({
  tasks,
  onClose,
}: {
  tasks: TaskWithClient[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-3xl rounded-[1.5rem] border border-red-200 bg-red-50/92 p-4 text-red-950 shadow-[0_18px_50px_rgba(127,29,29,0.18)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <Bell className="mt-1 h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-black">תזכורת: סניפים שלא בוצעו אתמול</p>
          <p className="mt-1 text-sm font-bold text-red-700">
            {tasks.map(({ client }) => client.storeName).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/80 p-2 text-red-700"
          aria-label="סגור תזכורת"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function DashboardPage({
  tasks,
  onOpenPayment,
  onOpenSpecialService,
}: {
  tasks: TaskWithClient[]
  onOpenPayment: (task: TaskWithClient) => void
  onOpenSpecialService: (task: TaskWithClient) => void
}) {
  const todayTasks = tasks
    .filter(({ task }) => task.scheduledDate === todayKey())
    .sort((a, b) => Number(a.task.status === 'done') - Number(b.task.status === 'done'))

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="מסלול עבודה" title="החנויות להיום" />

      {todayTasks.length === 0 ? (
        <EmptyState title="אין משימות להיום" text="אפשר להוסיף לקוח חדש או להעביר משימה מהיומן." />
      ) : (
        <div className="space-y-4">
          {todayTasks.map((item) => (
            <StoreCard
              key={item.task.id}
              item={item}
              onOpenPayment={onOpenPayment}
              onOpenSpecialService={onOpenSpecialService}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function StoreCard({
  item,
  onOpenPayment,
  onOpenSpecialService,
}: {
  item: TaskWithClient
  onOpenPayment: (task: TaskWithClient) => void
  onOpenSpecialService: (task: TaskWithClient) => void
}) {
  const isDone = item.task.status === 'done'
  const specialServices = item.task.specialServices ?? []
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    item.client.address,
  )}`

  return (
    <article
      className={`rounded-[1.75rem] border p-5 shadow-[0_18px_55px_rgba(10,83,112,0.10)] transition ${
        isDone
          ? 'border-emerald-200/80 bg-emerald-50/80 backdrop-blur-xl'
          : 'glass-card'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            {item.client.storeName}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-base font-semibold text-stone-500">
            <MapPin className="h-4 w-4 text-cyan-600" />
            {item.client.address}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 px-3 py-2 text-lg font-black text-cyan-800">
          {currency.format(getTaskTotal(item))}
        </div>
      </div>

      {specialServices.length > 0 && (
        <div className="mb-4 space-y-2 rounded-2xl border border-cyan-100 bg-white/70 p-3">
          <p className="text-sm font-black text-cyan-800">שירותים מיוחדים</p>
          {specialServices.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between gap-3 text-sm font-bold text-slate-600"
            >
              <span>{service.name}</span>
              <span>{currency.format(service.price)}</span>
            </div>
          ))}
        </div>
      )}

      {isDone && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold text-emerald-800">
          <Check className="h-5 w-5" />
          בוצע · {item.task.paymentMethod ? paymentLabels[item.task.paymentMethod] : 'שולם'}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <a
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white/80 px-4 text-lg font-black text-cyan-900 shadow-lg shadow-cyan-500/10 backdrop-blur"
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation className="h-5 w-5" />
          ניווט
        </a>
        <button
          type="button"
          disabled={isDone}
          onClick={() => onOpenPayment(item)}
          className="aqua-gradient soft-glow flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 text-lg font-black text-white disabled:bg-emerald-600"
        >
          <Check className="h-5 w-5" />
          בוצע
        </button>
      </div>
      {!isDone && (
        <button
          type="button"
          onClick={() => onOpenSpecialService(item)}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white/80 px-4 text-base font-black text-cyan-900 shadow-lg shadow-cyan-500/10 backdrop-blur"
        >
          <Plus className="h-5 w-5" />
          הוסף שירות מיוחד
        </button>
      )}
    </article>
  )
}

function CalendarPage({
  tasks,
  onMoveTask,
}: {
  tasks: TaskWithClient[]
  onMoveTask: (taskId: string, scheduledDate: string) => void
}) {
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)

  const monthDays = useMemo(() => {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const startOffset = firstDay.getDay()

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 - startOffset + index)
      return toDateKey(date)
    })
  }, [monthDate])

  const selectedTasks = tasks.filter(({ task }) => task.scheduledDate === selectedDate)

  const moveToDate = (dateKey: string) => {
    if (movingTaskId) {
      onMoveTask(movingTaskId, dateKey)
      setMovingTaskId(null)
    }
    setSelectedDate(dateKey)
  }

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="תכנון קדימה" title="יומן עבודה" />

      <div className="glass-card rounded-[1.75rem] p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 p-3 shadow-sm"
            onClick={() =>
              setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))
            }
            aria-label="החודש הבא"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-black">
            {new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(
              monthDate,
            )}
          </h2>
          <button
            type="button"
            className="rounded-full border border-white/70 bg-white/70 p-3 shadow-sm"
            onClick={() =>
              setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))
            }
            aria-label="החודש הקודם"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {movingTaskId && (
          <div className="mb-3 rounded-2xl border border-cyan-100 bg-cyan-50/80 px-4 py-3 text-sm font-bold text-cyan-800">
            בחר יום ביומן כדי להעביר אליו את המשימה.
          </div>
        )}

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-stone-400">
          {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {monthDays.map((dateKey) => {
            const dayTasks = tasks.filter(({ task }) => task.scheduledDate === dateKey)
            const isSelected = dateKey === selectedDate
            const fullyPaid =
              dayTasks.length > 0 &&
              dayTasks.every(
                ({ task }) => task.status === 'done' && task.paymentMethod !== 'debt',
              )
            const hasOpenItems = dayTasks.some(
              ({ task }) => task.status === 'pending' || task.paymentMethod === 'debt',
            )

            return (
              <button
                type="button"
                key={dateKey}
                onClick={() => moveToDate(dateKey)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const taskId = event.dataTransfer.getData('task-id')
                  if (taskId) onMoveTask(taskId, dateKey)
                  setSelectedDate(dateKey)
                }}
                className={`min-h-14 rounded-2xl border p-2 text-sm font-black transition ${
                  isSelected
                    ? 'border-cyan-600 aqua-gradient text-white shadow-lg shadow-cyan-500/20'
                    : isSameMonth(dateKey, monthDate)
                      ? 'border-white/70 bg-white/60 text-slate-900 backdrop-blur'
                      : 'border-transparent bg-transparent text-slate-300'
                }`}
              >
                <span>{new Date(`${dateKey}T12:00:00`).getDate()}</span>
                <span className="mt-1 flex justify-center gap-1">
                  {fullyPaid && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  {hasOpenItems && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="glass-card rounded-[1.75rem] p-5">
        <h3 className="mb-4 text-xl font-black">{formatHebrewDate(selectedDate)}</h3>
        {selectedTasks.length === 0 ? (
          <EmptyState title="אין חנויות ביום הזה" text="אפשר לגרור או לבחור משימה ולהעביר לכאן." />
        ) : (
          <div className="space-y-3">
            {selectedTasks.map(({ task, client }) => (
              <div
                key={task.id}
                draggable={task.status === 'pending'}
                onDragStart={(event) => event.dataTransfer.setData('task-id', task.id)}
                className="rounded-2xl border border-white/70 bg-white/60 p-4 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{client.storeName}</p>
                    <p className="text-sm font-semibold text-stone-500">
                      {client.address} · {currency.format(getTaskTotal({ task, client }))}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      task.status === 'done'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-cyan-50 text-cyan-800'
                    }`}
                  >
                    {task.status === 'done' ? 'בוצע' : 'פתוח'}
                  </span>
                </div>
                {task.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-2xl border border-cyan-200 bg-white/80 px-4 py-3 text-sm font-black text-cyan-900 shadow-sm"
                      onClick={() => setMovingTaskId(task.id)}
                    >
                      בחר יום בלוח השנה
                    </button>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-2xl bg-cyan-50 px-3 py-3 text-sm font-black text-cyan-800"
                        onClick={() => {
                          const nextDate = addDays(task.scheduledDate, 1)
                          onMoveTask(task.id, nextDate)
                          setSelectedDate(nextDate)
                        }}
                      >
                        דחה למחר
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl bg-cyan-50 px-3 py-3 text-sm font-black text-cyan-800"
                        onClick={() => {
                          const nextDate = addDays(task.scheduledDate, 7)
                          onMoveTask(task.id, nextDate)
                          setSelectedDate(nextDate)
                        }}
                      >
                        דחה שבוע
                      </button>
                    </div>
                    <label className="mt-3 block">
                      <span className="mb-2 block text-sm font-black text-slate-600">
                        או בחר תאריך חדש
                      </span>
                      <input
                        type="date"
                        value={task.scheduledDate}
                        onChange={(event) => {
                          onMoveTask(task.id, event.target.value)
                          setSelectedDate(event.target.value)
                        }}
                        className="min-h-12 w-full rounded-2xl border border-cyan-200 bg-white/85 px-4 text-base font-black text-cyan-950 outline-none focus:border-cyan-500"
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ClientPage({
  clients,
  onAddClient,
  onDeleteClient,
}: {
  clients: Client[]
  onAddClient: (client: Omit<Client, 'id'>, firstServiceDate: string) => void
  onDeleteClient: (clientId: string) => void
}) {
  const [storeName, setStoreName] = useState('')
  const [address, setAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [price, setPrice] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [firstServiceDate, setFirstServiceDate] = useState(todayKey())

  const submitClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!storeName || !address || !contactName || !phone || !price) return

    onAddClient(
      {
        storeName,
        address,
        contactName,
        phone,
        price: Number(price),
        frequency,
      },
      firstServiceDate,
    )

    setStoreName('')
    setAddress('')
    setContactName('')
    setPhone('')
    setPrice('')
    setFrequency('weekly')
    setFirstServiceDate(todayKey())
  }

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="ניהול לקוחות" title="הוספת חנות חדשה" />

      <form
        onSubmit={submitClient}
        className="glass-card space-y-4 rounded-[1.75rem] p-5"
      >
        <TextField label="שם החנות" value={storeName} onChange={setStoreName} required />
        <TextField label="כתובת מלאה" value={address} onChange={setAddress} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="שם איש קשר" value={contactName} onChange={setContactName} required />
          <TextField label="טלפון" value={phone} onChange={setPhone} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="מחיר קבוע לניקוי"
            value={price}
            onChange={setPrice}
            type="number"
            required
          />
          <TextField
            label="תאריך ביקור ראשון"
            value={firstServiceDate}
            onChange={setFirstServiceDate}
            type="date"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-stone-700">תדירות הסיבוב</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(frequencyLabels) as Frequency[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFrequency(option)}
                className={`min-h-14 rounded-2xl border px-2 text-sm font-black ${
                  frequency === option
                    ? 'border-cyan-600 aqua-gradient text-white shadow-lg shadow-cyan-500/20'
                    : 'border-white/70 bg-white/60 text-slate-700'
                }`}
              >
                {frequencyLabels[option]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="aqua-gradient soft-glow flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-black text-white"
        >
          <Plus className="h-5 w-5" />
          הוסף לקוח ושבץ ביומן
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="px-1 text-xl font-black">חנויות במערכת</h3>
        {clients.map((client) => {
          const phoneLink = getPhoneLink(client.phone)
          return (
            <article
              key={client.id}
              className="glass-card rounded-[1.5rem] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black">{client.storeName}</h4>
                  <p className="mt-1 text-sm font-semibold text-stone-500">
                    {client.contactName} · {frequencyLabels[client.frequency]}
                  </p>
                </div>
                <span className="rounded-2xl border border-cyan-100 bg-cyan-50/80 px-3 py-2 text-sm font-black text-cyan-800">
                  {currency.format(client.price)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <a
                  href={`tel:${phoneLink}`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white/80 font-black text-cyan-900 shadow-sm"
                >
                  <Phone className="h-4 w-4" />
                  חיוג
                </a>
                <a
                  href={`https://wa.me/972${phoneLink.replace(/^0/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-black text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  וואטסאפ
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const shouldDelete = window.confirm(
                      `למחוק את ${client.storeName}? כל המשימות של הלקוח יימחקו גם כן.`,
                    )
                    if (shouldDelete) onDeleteClient(client.id)
                  }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 font-black text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  מחק
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function NotesPage({
  clients,
  notes,
  onAddNote,
  onToggleNote,
  onDeleteNote,
}: {
  clients: Client[]
  notes: ReminderNote[]
  onAddNote: (note: Omit<ReminderNote, 'id' | 'createdAt' | 'isDone'>) => void
  onToggleNote: (noteId: string) => void
  onDeleteNote: (noteId: string) => void
}) {
  const [text, setText] = useState('')
  const [clientId, setClientId] = useState('')
  const [reminderDate, setReminderDate] = useState(todayKey())

  const clientById = new Map(clients.map((client) => [client.id, client]))
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isDone !== b.isDone) return Number(a.isDone) - Number(b.isDone)
    return a.reminderDate.localeCompare(b.reminderDate)
  })

  const submitNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!text.trim()) return

    onAddNote({
      text: text.trim(),
      clientId: clientId || null,
      reminderDate,
    })

    setText('')
    setClientId('')
    setReminderDate(todayKey())
  }

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="תזכורות והערות" title="מה אסור לשכוח" />

      <form onSubmit={submitNote} className="glass-card space-y-4 rounded-[1.75rem] p-5">
        <label className="block">
          <span className="mb-2 block text-sm font-black text-slate-700">הערה / תזכורת</span>
          <textarea
            value={text}
            required
            rows={4}
            onChange={(event) => setText(event.target.value)}
            placeholder="לדוגמה: לבדוק שלט, חלון נוסף, לדבר עם בעל החנות..."
            className="w-full rounded-2xl border border-white/70 bg-white/58 px-4 py-3 text-lg font-bold text-slate-950 outline-none backdrop-blur transition focus:border-cyan-400 focus:bg-white/85"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">שייך לסניף</span>
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="min-h-14 w-full rounded-2xl border border-white/70 bg-white/58 px-4 text-lg font-bold text-slate-950 outline-none backdrop-blur transition focus:border-cyan-400 focus:bg-white/85"
            >
              <option value="">כללי</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.storeName}
                </option>
              ))}
            </select>
          </label>

          <TextField
            label="תאריך תזכורת"
            value={reminderDate}
            onChange={setReminderDate}
            type="date"
            required
          />
        </div>

        <button
          type="submit"
          className="aqua-gradient soft-glow flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-black text-white"
        >
          <Plus className="h-5 w-5" />
          הוסף תזכורת
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="px-1 text-xl font-black">כל ההערות והתזכורות</h3>
        {sortedNotes.length === 0 ? (
          <EmptyState title="אין עדיין תזכורות" text="כאן יופיעו הערות כלליות או הערות לפי סניף." />
        ) : (
          sortedNotes.map((note) => {
            const client = note.clientId ? clientById.get(note.clientId) : null
            return (
              <article
                key={note.id}
                className={`glass-card rounded-[1.5rem] p-4 ${note.isDone ? 'opacity-60' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-cyan-700">
                      {client ? client.storeName : 'כללי'} · {formatShortDate(note.reminderDate)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-lg font-black text-slate-950">
                      {note.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    className="rounded-full bg-red-50 p-3 text-red-700"
                    aria-label="מחק תזכורת"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleNote(note.id)}
                  className={`min-h-12 w-full rounded-2xl text-sm font-black ${
                    note.isDone
                      ? 'bg-white/70 text-slate-600'
                      : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {note.isDone ? 'סומן כטופל' : 'סמן כטופל'}
                </button>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

function FinancePage({
  tasks,
  expenses,
  onOpenExpense,
}: {
  tasks: TaskWithClient[]
  expenses: AppDatabase['expenses']
  onOpenExpense: () => void
}) {
  const today = todayKey()
  const now = new Date()
  const paidTasks = tasks.filter(
    ({ task }) => task.status === 'done' && task.paymentMethod && task.paymentMethod !== 'debt',
  )
  const todayRevenue = paidTasks
    .filter(({ task }) => task.scheduledDate === today)
    .reduce((sum, item) => sum + getTaskTotal(item), 0)
  const monthRevenue = paidTasks
    .filter(({ task }) => isSameMonth(task.scheduledDate, now))
    .reduce((sum, item) => sum + getTaskTotal(item), 0)
  const todayExpenses = expenses
    .filter((expense) => expense.date === today)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const monthExpenses = expenses
    .filter((expense) => isSameMonth(expense.date, now))
    .reduce((sum, expense) => sum + expense.amount, 0)
  const debts = tasks.filter(({ task }) => task.status === 'done' && task.paymentMethod === 'debt')

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="דשבורד פיננסי" title="כסף, הוצאות וחובות" />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="הכנסות היום" value={currency.format(todayRevenue)} tone="emerald" />
        <MetricCard label="הכנסות החודש" value={currency.format(monthRevenue)} tone="emerald" />
        <MetricCard label="הוצאות היום" value={currency.format(todayExpenses)} tone="amber" />
        <MetricCard label="הוצאות החודש" value={currency.format(monthExpenses)} tone="amber" />
      </div>

      <button
        type="button"
        onClick={onOpenExpense}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-white/80 text-lg font-black text-cyan-900 shadow-lg shadow-cyan-500/10 backdrop-blur"
      >
        <ReceiptText className="h-5 w-5" />
        הוסף הוצאה
      </button>

      <div className="glass-card rounded-[1.75rem] p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <h3 className="text-xl font-black">רשימת חובות פתוחים</h3>
        </div>
        {debts.length === 0 ? (
          <EmptyState title="אין חובות פתוחים" text="כל העבודות שבוצעו גם שולמו." />
        ) : (
          <div className="space-y-3">
            {debts.map(({ task, client }) => (
              <div key={task.id} className="rounded-2xl bg-red-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-red-950">{client.storeName}</p>
                    <p className="text-sm font-semibold text-red-700">
                      {formatShortDate(task.scheduledDate)} · {client.contactName}
                    </p>
                  </div>
                  <p className="text-xl font-black text-red-700">
                    {currency.format(getTaskTotal({ task, client }))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function SpecialServiceModal({
  task,
  onClose,
  onAddService,
}: {
  task: TaskWithClient
  onClose: () => void
  onAddService: (service: { name: string; price: number }) => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  const submitService = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name || !price) return
    onAddService({ name, price: Number(price) })
  }

  return (
    <Modal title="שירות מיוחד" onClose={onClose}>
      <p className="mb-5 text-center text-lg font-bold text-stone-600">{task.client.storeName}</p>
      <form onSubmit={submitService} className="space-y-4">
        <TextField
          label="מה השירות?"
          value={name}
          onChange={setName}
          required
        />
        <TextField
          label="מחיר השירות"
          value={price}
          onChange={setPrice}
          type="number"
          required
        />
        <button
          type="submit"
          className="aqua-gradient soft-glow min-h-14 w-full rounded-2xl text-lg font-black text-white"
        >
          הוסף לשירות היום
        </button>
      </form>
    </Modal>
  )
}

function PaymentsPage({ tasks }: { tasks: TaskWithClient[] }) {
  const todayTasks = tasks.filter(({ task }) => task.scheduledDate === todayKey())
  const paidTasks = todayTasks.filter(
    ({ task }) => task.status === 'done' && task.paymentMethod && task.paymentMethod !== 'debt',
  )
  const unpaidTasks = todayTasks.filter(
    ({ task }) => task.status === 'done' && task.paymentMethod === 'debt',
  )
  const openTasks = todayTasks.filter(({ task }) => task.status === 'pending')

  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="מעקב גבייה" title="מי שילם ומי לא" />

      <div className="grid grid-cols-3 gap-2">
        <StatusSummaryCard label="שילמו" value={paidTasks.length} className="text-emerald-700" />
        <StatusSummaryCard label="בחוב" value={unpaidTasks.length} className="text-red-700" />
        <StatusSummaryCard label="פתוחים" value={openTasks.length} className="text-cyan-800" />
      </div>

      <PaymentGroup
        title="שילמו היום"
        emptyText="עדיין אין לקוחות שסומנו כשילמו היום."
        tone="paid"
        tasks={paidTasks}
      />
      <PaymentGroup
        title="לא שילמו / חוב"
        emptyText="אין חובות מהמסלול של היום."
        tone="debt"
        tasks={unpaidTasks}
      />
      <PaymentGroup
        title="עדיין לא סומנו בדף הראשי"
        emptyText="כל החנויות של היום כבר סומנו."
        tone="open"
        tasks={openTasks}
      />
    </section>
  )
}

function StatusSummaryCard({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className: string
}) {
  return (
    <div className="glass-card rounded-[1.25rem] p-3 text-center">
      <p className={`text-3xl font-black ${className}`}>{value}</p>
      <p className="mt-1 text-xs font-black text-slate-500">{label}</p>
    </div>
  )
}

function PaymentGroup({
  title,
  emptyText,
  tone,
  tasks,
}: {
  title: string
  emptyText: string
  tone: 'paid' | 'debt' | 'open'
  tasks: TaskWithClient[]
}) {
  const toneClasses = {
    paid: 'border-emerald-200 bg-emerald-50/80 text-emerald-800',
    debt: 'border-red-200 bg-red-50/80 text-red-800',
    open: 'border-cyan-200 bg-cyan-50/80 text-cyan-800',
  }

  return (
    <div className="glass-card rounded-[1.75rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xl font-black text-slate-950">{title}</h3>
        <span className={`rounded-full border px-3 py-1 text-sm font-black ${toneClasses[tone]}`}>
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="אין רשומות" text={emptyText} />
      ) : (
        <div className="space-y-3">
          {tasks.map(({ task, client }) => (
            <article key={task.id} className="rounded-2xl border border-white/70 bg-white/68 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{client.storeName}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {client.contactName} · {formatShortDate(task.scheduledDate)}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {task.paymentMethod ? paymentLabels[task.paymentMethod] : 'עדיין לא בוצע'}
                  </p>
                </div>
                <span className={`rounded-2xl border px-3 py-2 text-sm font-black ${toneClasses[tone]}`}>
                  {currency.format(getTaskTotal({ task, client }))}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function PaymentModal({
  task,
  onClose,
  onPay,
}: {
  task: TaskWithClient
  onClose: () => void
  onPay: (method: PaymentMethod) => void
}) {
  return (
    <Modal title="איך שולם?" onClose={onClose}>
      <p className="mb-5 text-center text-lg font-bold text-stone-600">{task.client.storeName}</p>
      <div className="space-y-3">
        {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => onPay(method)}
            className={`min-h-16 w-full rounded-2xl text-lg font-black ${
              method === 'debt'
                ? 'bg-red-50 text-red-700'
                : method === 'transfer'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-cyan-50 text-cyan-800'
            }`}
          >
            {paymentLabels[method]}
          </button>
        ))}
      </div>
    </Modal>
  )
}

function ExpenseModal({
  onClose,
  onAddExpense,
}: {
  onClose: () => void
  onAddExpense: (expense: Omit<AppDatabase['expenses'][number], 'id'>) => void
}) {
  const [category, setCategory] = useState<ExpenseCategory>('fuel')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayKey())

  const submitExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!amount) return
    onAddExpense({ category, amount: Number(amount), note, date })
  }

  return (
    <Modal title="הוספת הוצאה" onClose={onClose}>
      <form onSubmit={submitExpense} className="space-y-4">
        <TextField label="סכום" value={amount} onChange={setAmount} type="number" required />
        <TextField label="תאריך" value={date} onChange={setDate} type="date" required />
        <div>
          <label className="mb-2 block text-sm font-black text-stone-700">קטגוריה</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(expenseCategoryLabels) as ExpenseCategory[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                className={`min-h-12 rounded-2xl text-sm font-black ${
                  category === option
                    ? 'aqua-gradient text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-white/65 text-slate-700'
                }`}
              >
                {expenseCategoryLabels[option]}
              </button>
            ))}
          </div>
        </div>
        <TextField label="הערה" value={note} onChange={setNote} />
        <button
          type="submit"
          className="aqua-gradient soft-glow min-h-14 w-full rounded-2xl text-lg font-black text-white"
        >
          שמור הוצאה
        </button>
      </form>
    </Modal>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/32 p-4 backdrop-blur-md sm:items-center">
      <div className="glass-panel w-full max-w-md rounded-[2rem] p-5">
        <div className="glass-content">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose} className="rounded-full bg-white/70 p-3">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-black">{title}</h2>
          <span className="h-11 w-11" />
        </div>
        {children}
        </div>
      </div>
    </div>
  )
}

function BottomNavigation({
  activePage,
  onChange,
}: {
  activePage: Page
  onChange: (page: Page) => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/72 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 shadow-[0_-18px_55px_rgba(10,83,112,0.12)] backdrop-blur-2xl">
      <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1.5">
        {(Object.keys(pageMeta) as Page[]).map((page) => {
          const Icon = pageMeta[page].icon
          const isActive = activePage === page
          return (
            <button
              key={page}
              type="button"
              onClick={() => onChange(page)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.68rem] font-black transition ${
                isActive ? 'aqua-gradient text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              {pageMeta[page].label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="px-1">
      <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-700">{eyebrow}</p>
      <h2 className="text-3xl font-black tracking-tight text-slate-950">{title}</h2>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: React.HTMLInputTypeAttribute
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-stone-700">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-14 w-full rounded-2xl border border-white/70 bg-white/58 px-4 text-lg font-bold text-slate-950 outline-none backdrop-blur transition focus:border-cyan-400 focus:bg-white/85"
      />
    </label>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'emerald' | 'amber'
}) {
  return (
    <div
      className={`rounded-[1.5rem] border p-4 shadow-[0_14px_42px_rgba(38,34,27,0.07)] ${
        tone === 'emerald'
          ? 'border-emerald-100 bg-emerald-50/90'
          : 'border-[#f0dfba] bg-[#fff7e6]'
      }`}
    >
      <p className="text-sm font-black text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-stone-200 bg-white/60 p-6 text-center">
      <p className="text-xl font-black text-stone-800">{title}</p>
      <p className="mt-2 font-semibold text-stone-500">{text}</p>
    </div>
  )
}

export default App
