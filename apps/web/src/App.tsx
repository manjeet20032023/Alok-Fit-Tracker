import { startTransition, useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, CalendarDays, Check, Dumbbell, History, Home, Library, Pause, Play, Plus, Settings, UserRound } from 'lucide-react'
import { createId, db, localDate, weeklySplit, type CardioEntry, type Exercise, type Goal, type Measurement, type PersonalRecord, type ProgressPhoto, type SyncOutboxItem, type Workout, type WorkoutExercise, type WorkoutSet } from './data/db'
import { calculateElapsedSeconds, formatElapsed } from './domain/stopwatch'
import { supabase, supabaseConfigured } from './data/supabase'
import { enqueue, resolveWorkoutConflict, syncNow } from './data/sync'
import { exportCSV, exportJSON } from './data/export'
import { restoreBackup, validateBackup } from './data/import'
import { derivePersonalRecords, getCurrentPersonalRecords, getProgressionSuggestion, getRecentStrengthLogs } from './domain/progression'
import './styles.css'

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/workout', label: 'Workout', icon: Dumbbell },
  { path: '/history', label: 'History', icon: History },
  { path: '/library', label: 'Library', icon: Library },
  { path: '/plan', label: 'Plan', icon: CalendarDays },
  { path: '/measurements', label: 'Measurements', icon: Activity },
  { path: '/goals', label: 'Goals', icon: Check },
  { path: '/photos', label: 'Progress photos', icon: UserRound },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/progression', label: 'PRs & Progression', icon: Check },
  { path: '/settings', label: 'Settings', icon: Settings },
]

const currentTime = () => new Date()
const currentTimestamp = () => currentTime().toISOString()
const workoutExerciseCatalog = [
  { name: 'Bench Press', muscleGroup: 'Chest', section: 'weight' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', section: 'weight' },
  { name: 'Lat Pulldown', muscleGroup: 'Back', section: 'weight' },
  { name: 'Barbell Row', muscleGroup: 'Back', section: 'weight' },
  { name: 'Cable Row', muscleGroup: 'Back', section: 'weight' },
  { name: 'Back Squat', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', section: 'weight' },
  { name: 'Overhead Press', muscleGroup: 'Shoulders', section: 'weight' },
  { name: 'Triceps Pushdown', muscleGroup: 'Triceps', section: 'weight' },
  { name: 'Cable Curl', muscleGroup: 'Biceps', section: 'weight' },
  { name: 'Plank', muscleGroup: 'Core', section: 'core' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', section: 'core' },
] as const

type PastExerciseDraft = { id: string; name: string; muscleGroup: string; setCount: string; reps: string; weightKg: string }
const initialPastExercise: PastExerciseDraft = { id: 'initial', name: '', muscleGroup: '', setCount: '3', reps: '10', weightKg: '0' }

function App() {
  return <BrowserRouter><Shell /></BrowserRouter>
}

function Shell() {
  const navigate = useNavigate()
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark"><Dumbbell size={19} /></span><span>Alok Fit</span></div><nav className="nav-list">{navItems.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `nav-button ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="online"><span className="online-dot" />Local-first storage ready</div></div></aside><main className="main"><header className="topbar"><div className="page-title">Alok Fit Tracker</div><div className="top-actions"><button className="avatar" aria-label="Profile settings" onClick={() => navigate('/settings')}><UserRound size={18} /></button></div></header><Routes><Route path="/" element={<Dashboard />} /><Route path="/workout" element={<WorkoutLogger />} /><Route path="/history" element={<HistoryPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/plan" element={<PlanPage />} /><Route path="/measurements" element={<MeasurementsPage />} /><Route path="/goals" element={<GoalsPage />} /><Route path="/photos" element={<PhotosPage />} /><Route path="/reports" element={<ReportsPage />} /><Route path="/progression" element={<ProgressionPage />} /><Route path="/settings" element={<SettingsPage />} /></Routes></main><nav className="bottom-nav" aria-label="Primary navigation">{navItems.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'active' : ''} title={label}><Icon size={19} /><span>{label}</span></NavLink>)}</nav></div>
}

function Dashboard() {
  const navigate = useNavigate()
  const [today] = useState(() => currentTime())
  const [active, setActive] = useState<Workout | null>(null)
  const [completed, setCompleted] = useState<Workout[]>([])
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dayPlan = weeklySplit.find((item) => item.day === weekday) ?? weeklySplit[0]
  useEffect(() => { void (async () => { setActive(await db.workouts.where('status').anyOf(['in_progress', 'paused']).first() ?? null); setCompleted((await db.workouts.where('status').equals('completed').reverse().sortBy('completedAt')).slice(0, 5)) })() }, [])
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>Good morning, Alok</h1></div></div><div className="dashboard-grid"><section className="plan-card"><div><div className="eyebrow" style={{ color: '#d7ef6d' }}>Today's focus</div><h2>{dayPlan.focus.join(' + ')}</h2><p>{dayPlan.focus.includes('Rest') ? 'Recovery day. Rest, mobility and a routine of your choice.' : `Single gym session • Cardio • Abs & Core • ${dayPlan.focus.join(' + ')}`}</p></div>{active ? <button className="primary-button" onClick={() => navigate('/workout')}><Play size={17} />Resume workout</button> : dayPlan.focus.includes('Rest') ? <button className="secondary-button" onClick={() => navigate('/plan')}>View weekly plan</button> : <button className="primary-button" onClick={() => navigate('/workout')}><Plus size={17} />Start workout</button>}</section><div className="stat-grid"><StatCard label="This week" value={`${completed.length}`} suffix="sessions" /><StatCard label="Target" value="120-150" suffix="minutes" /><StatCard label="Storage" value="Local" suffix="offline ready" /><StatCard label="Last session" value={completed[0]?.durationSeconds ? formatElapsed(completed[0].durationSeconds) : '--:--:--'} suffix="duration" /></div></div><div className="section-row"><section className="section-card"><strong>Cardio</strong><p>Every gym day • 1 combined session</p></section><section className="section-card"><strong>Abs & Core</strong><p>Logged inside today's workout</p></section><section className="section-card"><strong>Weight training</strong><p>{dayPlan.focus.join(' + ')}</p></section></div><section className="panel" style={{ marginTop: 18 }}><div className="panel-header"><h2>Recent workouts</h2><button className="secondary-button" onClick={() => navigate('/history')}>View all</button></div>{completed.length === 0 ? <div className="empty-state">No completed workouts yet. Your first session will appear here.</div> : <table className="table"><thead><tr><th>Date</th><th>Focus</th><th>Duration</th></tr></thead><tbody>{completed.map((workout) => <tr key={workout.id}><td>{workout.localDate}</td><td>{workout.plannedFocus.join(' + ')}</td><td>{workout.durationSeconds ? formatElapsed(workout.durationSeconds) : '--'}</td></tr>)}</tbody></table>}</section></div>
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) { return <article className="stat-card"><span className="label">{label}</span><strong>{value}</strong><small>{suffix}</small></article> }

function WorkoutLogger() {
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [section, setSection] = useState<'cardio' | 'core' | 'weight'>('cardio')
  const [now, setNow] = useState(() => currentTime())
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [cardio, setCardio] = useState<CardioEntry[]>([])
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [finishOpen, setFinishOpen] = useState(false)
  const [restSeconds, setRestSeconds] = useState(90)
  const [restRunning, setRestRunning] = useState(false)
  useEffect(() => { if (!restRunning) return; const timer = window.setInterval(() => setRestSeconds((value) => { if (value <= 1) { setRestRunning(false); return 0 } return value - 1 }), 1000); return () => window.clearInterval(timer) }, [restRunning])
  async function load() { const active = await db.workouts.where('status').anyOf(['in_progress', 'paused']).first(); if (active) await open(active) }
  async function open(value: Workout) { setWorkout(value); await refresh(value.id) }
  async function refresh(workoutId: string) { setExercises(await db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order')); setSets(await db.workoutSets.where('workoutId').equals(workoutId).toArray()); setCardio(await db.cardioEntries.where('workoutId').equals(workoutId).toArray()) }
  useEffect(() => { void load(); const clock = window.setInterval(() => setNow(currentTime()), 1000); return () => window.clearInterval(clock) }, [])
  async function start() { const date = currentTime(); const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }); const focus = weeklySplit.find((item) => item.day === weekday)?.focus ?? ['Training']; if (focus.includes('Rest')) return; const value: Workout = { id: createId(), localDate: localDate(date), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, plannedFocus: focus, status: 'in_progress', startedAt: date.toISOString(), pausedAt: null, lastResumedAt: date.toISOString(), totalPausedSeconds: 0, completedAt: null, durationSeconds: null, notes: '', createdAt: date.toISOString(), updatedAt: date.toISOString(), revision: 1, deletedAt: null }; await db.workouts.add(value); await enqueue('workouts', value.id, value, value.revision); await open(value) }
  async function pauseResume() { if (!workout) return; const date = currentTime(); let next: Workout; if (workout.status === 'in_progress') next = { ...workout, status: 'paused', pausedAt: date.toISOString(), updatedAt: date.toISOString(), revision: workout.revision + 1 }; else { const pausedAt = Date.parse(workout.pausedAt ?? date.toISOString()); const added = Math.max(0, Math.floor((date.getTime() - pausedAt) / 1000)); next = { ...workout, status: 'in_progress', pausedAt: null, lastResumedAt: date.toISOString(), totalPausedSeconds: workout.totalPausedSeconds + added, updatedAt: date.toISOString(), revision: workout.revision + 1 } } await db.workouts.put(next); await enqueue('workouts', next.id, next, next.revision); setWorkout(next); setNow(date) }
  async function finish() { if (!workout) return; const finished = currentTime(); let totalPausedSeconds = workout.totalPausedSeconds; if (workout.status === 'paused' && workout.pausedAt) totalPausedSeconds += Math.max(0, Math.floor((finished.getTime() - Date.parse(workout.pausedAt)) / 1000)); const durationSeconds = calculateElapsedSeconds({ ...workout, status: 'completed', totalPausedSeconds, completedAt: finished.toISOString() }, finished); const next: Workout = { ...workout, status: 'completed', pausedAt: null, totalPausedSeconds, completedAt: finished.toISOString(), durationSeconds, updatedAt: finished.toISOString(), revision: workout.revision + 1 }; await db.workouts.put(next); await enqueue('workouts', next.id, next, next.revision); const strengthLogs = exercises.filter((exercise) => exercise.section === 'weight').map((exercise) => ({ exerciseId: exercise.id, exerciseName: exercise.name, workoutId: workout.id, achievedAt: finished.toISOString(), sets: sets.filter((set) => set.workoutExerciseId === exercise.id) })); const records = derivePersonalRecords(strengthLogs); if (records.length) { await db.personalRecords.bulkPut(records); for (const record of records) await enqueue('personalRecords', record.id, record, 1) } setWorkout(null); setFinishOpen(false) }
  async function addExercise(exerciseSection: 'weight' | 'core', name: string, muscle: string) { if (!workout || exercises.some((item) => item.section === exerciseSection && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return; const exercise: WorkoutExercise = { id: createId(), workoutId: workout.id, name, muscleGroup: muscle, section: exerciseSection, order: exercises.filter((item) => item.section === exerciseSection).length }; await db.workoutExercises.add(exercise); await enqueue('workoutExercises', exercise.id, exercise, 1); const set: WorkoutSet = { id: createId(), workoutExerciseId: exercise.id, workoutId: workout.id, setNumber: 1, reps: exerciseSection === 'core' ? null : 10, weightKg: exerciseSection === 'core' ? null : 0, durationSeconds: exerciseSection === 'core' ? 30 : null, completed: false, notes: '' }; await db.workoutSets.add(set); await enqueue('workoutSets', set.id, set, 1); await refresh(workout.id) }
  async function removeExercise(exercise: WorkoutExercise) {
    if (!workout || !window.confirm(`Remove ${exercise.name} and its sets from this workout?`)) return
    const exerciseSets = await db.workoutSets.where('workoutExerciseId').equals(exercise.id).toArray()
    await db.transaction('rw', [db.workoutExercises, db.workoutSets], async () => {
      await db.workoutSets.bulkDelete(exerciseSets.map((set) => set.id))
      await db.workoutExercises.delete(exercise.id)
    })
    for (const set of exerciseSets) await enqueue('workoutSets', set.id, set, set.revision ?? 1, 'delete')
    await enqueue('workoutExercises', exercise.id, exercise, exercise.revision ?? 1, 'delete')
    await refresh(workout.id)
  }
  async function updateSet(set: WorkoutSet, patch: Partial<WorkoutSet>) { const next = { ...set, ...patch }; await db.workoutSets.put(next); await enqueue('workoutSets', next.id, next, 1); if (workout) await refresh(workout.id) }
  async function addSet(exerciseId: string) { if (!workout) return; const count = sets.filter((set) => set.workoutExerciseId === exerciseId).length; const next: WorkoutSet = { id: createId(), workoutExerciseId: exerciseId, workoutId: workout.id, setNumber: count + 1, reps: 10, weightKg: 0, durationSeconds: null, completed: false, notes: '' }; await db.workoutSets.add(next); await enqueue('workoutSets', next.id, next, 1); await refresh(workout.id) }
  async function addCardio() { if (!workout) return; const entry: CardioEntry = { id: createId(), workoutId: workout.id, activityType: 'Treadmill running', durationSeconds: 0, distanceMeters: null, inclinePercent: null, heartRate: null, calories: null, notes: '' }; await db.cardioEntries.add(entry); await enqueue('cardioEntries', entry.id, entry, 1); await refresh(workout.id) }
  async function updateCardio(entry: CardioEntry, patch: Partial<CardioEntry>) { const next = { ...entry, ...patch }; await db.cardioEntries.put(next); await enqueue('cardioEntries', next.id, next, 1); if (workout) await refresh(workout.id) }

  if (!workout) return <div className="content"><div className="page-heading"><div><div className="eyebrow">Live session</div><h1>Workout logger</h1></div></div><section className="panel"><div className="empty-state"><Dumbbell size={28} /><p>No active workout.</p><button className="primary-button" onClick={start}>Start today's workout</button></div></section></div>
  const elapsed = calculateElapsedSeconds(workout, now)
  const visible = exercises.filter((item) => item.section === (section === 'core' ? 'core' : 'weight'))
  const availableExercises = workoutExerciseCatalog.filter((item) => item.section === (section === 'core' ? 'core' : 'weight'))
  const preferredExerciseName = section === 'core' ? 'Plank' : workout.plannedFocus.includes('Back') ? 'Lat Pulldown' : workout.plannedFocus.includes('Legs') ? 'Back Squat' : 'Bench Press'
  const selectedExercise = availableExercises.find((item) => item.name === selectedExerciseName) ?? availableExercises.find((item) => item.name === preferredExerciseName)
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">{workout.localDate}</div><h1>{workout.plannedFocus.join(' + ')}</h1></div><button className="danger-button" onClick={() => setFinishOpen(true)}>Finish workout</button></div><div className="workout-layout"><div><section className="timer-panel"><div><div className="eyebrow" style={{ color: '#d7ef6d' }}>{workout.status === 'paused' ? 'Workout paused' : 'Workout in progress'}</div><div className="timer">{formatElapsed(elapsed)}</div></div><button className="secondary-button" onClick={pauseResume}>{workout.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}{workout.status === 'paused' ? 'Resume workout' : 'Pause workout'}</button></section><div className="section-tabs" style={{ marginTop: 14 }}><button className={`section-tab ${section === 'cardio' ? 'active' : ''}`} onClick={() => setSection('cardio')}>Cardio</button><button className={`section-tab ${section === 'core' ? 'active' : ''}`} onClick={() => setSection('core')}>Abs & Core</button><button className={`section-tab ${section === 'weight' ? 'active' : ''}`} onClick={() => setSection('weight')}>Weight training</button></div><section className="panel">{section === 'cardio' ? <><div className="panel-header"><h2>Cardio</h2><button className="secondary-button" onClick={addCardio}><Plus size={16} />Add cardio</button></div>{cardio.length === 0 ? <div className="empty-state">Add treadmill, walking, running, cycling or elliptical.</div> : cardio.map((entry) => <div className="exercise-row" key={entry.id}><div className="field"><label>Activity</label><select value={entry.activityType} onChange={(event) => void updateCardio(entry, { activityType: event.target.value })}><option>Treadmill running</option><option>Treadmill walking</option><option>Incline walking</option><option>Outdoor running</option><option>Cycling</option><option>Elliptical</option><option>Other</option></select></div><div className="field"><label>Minutes</label><input type="number" min="0" value={entry.durationSeconds ? Math.round(entry.durationSeconds / 60) : ''} onChange={(event) => void updateCardio(entry, { durationSeconds: Number(event.target.value || 0) * 60 })} /></div><div className="field"><label>Distance km</label><input type="number" min="0" step="0.01" value={entry.distanceMeters ? Math.round(entry.distanceMeters / 10) / 100 : ''} onChange={(event) => void updateCardio(entry, { distanceMeters: Number(event.target.value || 0) * 1000 })} /></div><div className="field"><label>Incline %</label><input type="number" value={entry.inclinePercent ?? ''} onChange={(event) => void updateCardio(entry, { inclinePercent: event.target.value === '' ? null : Number(event.target.value) })} /></div></div>)}</> : <><div className="panel-header exercise-panel-header"><h2>{section === 'core' ? 'Abs & Core' : workout.plannedFocus.join(' + ')}</h2><div className="exercise-add"><label className="field"><span>Exercise</span><select value={selectedExercise?.name ?? ''} onChange={(event) => setSelectedExerciseName(event.target.value)}>{availableExercises.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><button className="primary-button" disabled={!selectedExercise || visible.some((item) => item.name === selectedExercise.name)} onClick={() => selectedExercise && void addExercise(selectedExercise.section, selectedExercise.name, selectedExercise.muscleGroup)}><Plus size={16} />Add exercise</button></div></div>{visible.length === 0 ? <div className="empty-state">No {section === 'core' ? 'core' : 'weight'} exercises added yet.</div> : visible.map((exercise) => <article className="logged-exercise" key={exercise.id}><div className="logged-exercise-title"><strong>{exercise.name}</strong> <span className="badge">{exercise.muscleGroup}</span><button className="danger-button" onClick={() => void removeExercise(exercise)}>Remove exercise</button></div>{sets.filter((set) => set.workoutExerciseId === exercise.id).map((set) => <div className="exercise-row" key={set.id}><div className="field"><label>Set {set.setNumber}</label><input aria-label={`${exercise.name} set ${set.setNumber} reps`} type="number" min="0" value={set.reps ?? ''} onChange={(event) => void updateSet(set, { reps: event.target.value === '' ? null : Number(event.target.value) })} /></div><div className="field"><label>{exercise.section === 'core' ? 'Seconds' : 'Weight kg'}</label><input type="number" min="0" step="0.5" value={exercise.section === 'core' ? set.durationSeconds ?? '' : set.weightKg ?? ''} onChange={(event) => void updateSet(set, exercise.section === 'core' ? { durationSeconds: event.target.value === '' ? null : Number(event.target.value) } : { weightKg: event.target.value === '' ? null : Number(event.target.value) })} /></div><div /><button aria-label={`Mark set ${set.setNumber} complete`} className={`check-button ${set.completed ? 'done' : ''}`} onClick={() => void updateSet(set, { completed: !set.completed })}>{set.completed ? <Check size={17} /> : null}</button></div>)}<button className="secondary-button" onClick={() => void addSet(exercise.id)}><Plus size={15} />Add set</button></article>)}</>}</section></div><aside className="rest-panel"><h3>Rest timer</h3><div className="rest-display">{formatElapsed(restSeconds).slice(3)}</div><div className="preset-grid">{[30,60,90,120,180].map((seconds) => <button key={seconds} onClick={() => { setRestSeconds(seconds); setRestRunning(false) }}>{seconds}s</button>)}</div><button className="primary-button" style={{ width: '100%' }} onClick={() => setRestRunning((running) => !running)}>{restRunning ? <Pause size={16} /> : <Play size={16} />}{restRunning ? 'Pause' : 'Start timer'}</button><button className="secondary-button" style={{ width: '100%', marginTop: 8 }} onClick={() => { setRestRunning(false); setRestSeconds(90) }}>Reset</button><p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Rest between sets counts toward workout duration.</p></aside></div>{finishOpen && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Finish workout?</h2><p>This saves the session duration and moves it to history. Workout entries remain editable later.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setFinishOpen(false)}>Continue workout</button><button className="primary-button" onClick={finish}>Confirm finish</button></div></div></div>}</div>
}

function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [conflicts, setConflicts] = useState<SyncOutboxItem[]>([])
  const [conflictMessage, setConflictMessage] = useState('')
  const [pastEntryOpen, setPastEntryOpen] = useState(false)
  const [pastDate, setPastDate] = useState(localDate())
  const [pastStartTime, setPastStartTime] = useState('18:00')
  const [pastEndTime, setPastEndTime] = useState('19:00')
  const [pastLocation, setPastLocation] = useState<NonNullable<Workout['location']>>('gym')
  const [pastFocus, setPastFocus] = useState('Strength training')
  const [pastExercises, setPastExercises] = useState<PastExerciseDraft[]>([initialPastExercise])
  const [pastMessage, setPastMessage] = useState('')
  async function load() {
    const [workouts, conflicts] = await Promise.all([
      db.workouts.where('status').equals('completed').reverse().sortBy('completedAt'),
      db.syncOutbox.where('status').equals('conflict').toArray(),
    ])
    startTransition(() => {
      setWorkouts(workouts.filter((workout) => !workout.deletedAt))
      setConflicts(conflicts)
    })
  }
  useEffect(() => { void load() }, [])
  async function resolveConflict(item: SyncOutboxItem, choice: 'keep-local' | 'use-cloud') {
    const resolved = await resolveWorkoutConflict(item.id, choice)
    if (!resolved) {
      setConflictMessage('Could not resolve this workout conflict. Sign in and try again.')
      return
    }
    if (choice === 'keep-local') await syncNow()
    setConflictMessage(choice === 'keep-local' ? 'Local version selected and sync retried.' : 'Cloud version restored on this device.')
    await load()
  }
  async function editWorkout(workout: Workout) {
    const localDate = window.prompt('Workout date (YYYY-MM-DD)', workout.localDate)
    if (localDate == null) return
    const dateParts = localDate.split('-').map(Number)
    const parsedDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || parsedDate.toISOString().slice(0, 10) !== localDate) {
      window.alert('Enter a valid date in YYYY-MM-DD format.')
      return
    }
    const focusText = window.prompt('Workout focus (comma-separated)', workout.plannedFocus.join(', '))
    if (focusText == null) return
    const plannedFocus = focusText.split(',').map((item) => item.trim()).filter(Boolean)
    if (!plannedFocus.length) {
      window.alert('Workout focus cannot be empty.')
      return
    }
    const notes = window.prompt('Workout notes', workout.notes)
    if (notes == null) return
    const now = currentTimestamp()
    const next = { ...workout, localDate, plannedFocus, notes, updatedAt: now, revision: workout.revision + 1 }
    await db.workouts.put(next)
    await enqueue('workouts', next.id, next, next.revision)
    await load()
  }
  async function deleteWorkout(workout: Workout) {
    if (!window.confirm('Delete this completed workout? Its entries will be kept as historical audit data unless removed separately.')) return
    const now = currentTimestamp()
    const next = { ...workout, deletedAt: now, updatedAt: now, revision: workout.revision + 1 }
    await db.workouts.put(next)
    await enqueue('workouts', next.id, next, next.revision, 'delete')
    await load()
  }
  function updatePastExercise(id: string, patch: Partial<PastExerciseDraft>) {
    setPastExercises((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }
  async function savePastWorkout() {
    const start = new Date(`${pastDate}T${pastStartTime}:00`)
    const end = new Date(`${pastDate}T${pastEndTime}:00`)
    const focus = pastFocus.split(',').map((item) => item.trim()).filter(Boolean)
    const drafts = pastExercises.filter((item) => item.name.trim())
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setPastMessage('Enter a valid date and an end time after the start time.')
      return
    }
    if (!focus.length || !drafts.length || drafts.some((item) => !item.muscleGroup.trim() || !Number.isInteger(Number(item.setCount)) || Number(item.setCount) < 1 || !Number.isInteger(Number(item.reps)) || Number(item.reps) < 0 || !Number.isFinite(Number(item.weightKg)) || Number(item.weightKg) < 0)) {
      setPastMessage('Add at least one exercise and enter a muscle group, set count, reps, and non-negative weight for each.')
      return
    }

    const now = currentTimestamp()
    const workout: Workout = {
      id: createId(), localDate: pastDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      plannedFocus: focus, location: pastLocation, status: 'completed', startedAt: start.toISOString(), pausedAt: null,
      lastResumedAt: start.toISOString(), totalPausedSeconds: 0, completedAt: end.toISOString(),
      durationSeconds: Math.floor((end.getTime() - start.getTime()) / 1000), notes: 'Logged after training',
      createdAt: now, updatedAt: now, revision: 1, deletedAt: null,
    }
    const exercises: WorkoutExercise[] = drafts.map((draft, order) => ({
      id: createId(), workoutId: workout.id, name: draft.name.trim(), muscleGroup: draft.muscleGroup.trim(), section: 'weight', order,
    }))
    const sets: WorkoutSet[] = drafts.flatMap((draft, index) => Array.from({ length: Number(draft.setCount) }, (_, setIndex) => ({
      id: createId(), workoutExerciseId: exercises[index].id, workoutId: workout.id, setNumber: setIndex + 1,
      reps: Number(draft.reps), weightKg: Number(draft.weightKg), durationSeconds: null, completed: true, notes: '',
    })))
    await db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets], async () => {
      await db.workouts.add(workout)
      await db.workoutExercises.bulkAdd(exercises)
      await db.workoutSets.bulkAdd(sets)
    })
    await enqueue('workouts', workout.id, workout, workout.revision)
    for (const exercise of exercises) await enqueue('workoutExercises', exercise.id, exercise, 1)
    for (const set of sets) await enqueue('workoutSets', set.id, set, 1)
    const records = derivePersonalRecords(exercises.map((exercise) => ({
      exerciseId: exercise.id, exerciseName: exercise.name, workoutId: workout.id, achievedAt: workout.completedAt!,
      sets: sets.filter((set) => set.workoutExerciseId === exercise.id),
    })))
    if (records.length) {
      await db.personalRecords.bulkPut(records)
      for (const record of records) await enqueue('personalRecords', record.id, record, 1)
    }
    setPastMessage('Past workout saved.')
    setPastEntryOpen(false)
    setPastDate(localDate())
    setPastExercises([initialPastExercise])
    await load()
  }
  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow">Training log</div><h1>Workout history</h1></div><button className="primary-button" onClick={() => setPastEntryOpen((open) => !open)}>{pastEntryOpen ? 'Close form' : 'Log past workout'}</button></div>
    {pastMessage && <p className="status-message" role="status">{pastMessage}</p>}
    {pastEntryOpen && <section className="panel past-workout-form">
      <div className="panel-header"><h2>Workout details</h2></div>
      <div className="past-workout-grid">
        <div className="field"><label htmlFor="past-date">Date</label><input id="past-date" type="date" value={pastDate} onChange={(event) => setPastDate(event.target.value)} /></div>
        <div className="field"><label htmlFor="past-location">Location</label><select id="past-location" value={pastLocation} onChange={(event) => setPastLocation(event.target.value as NonNullable<Workout['location']>)}><option value="gym">Gym</option><option value="home">Home</option><option value="other">Other</option></select></div>
        <div className="field"><label htmlFor="past-start">From</label><input id="past-start" type="time" value={pastStartTime} onChange={(event) => setPastStartTime(event.target.value)} /></div>
        <div className="field"><label htmlFor="past-end">To</label><input id="past-end" type="time" value={pastEndTime} onChange={(event) => setPastEndTime(event.target.value)} /></div>
        <div className="field past-focus"><label htmlFor="past-focus">Workout focus</label><input id="past-focus" value={pastFocus} onChange={(event) => setPastFocus(event.target.value)} placeholder="Back, Biceps" /></div>
      </div>
      <div className="past-exercise-list">{pastExercises.map((item) => <div className="past-exercise-row" key={item.id}>
        <div className="field"><label>Exercise</label><input value={item.name} onChange={(event) => updatePastExercise(item.id, { name: event.target.value })} placeholder="e.g. Lat Pulldown" /></div>
        <div className="field"><label>Muscle group</label><input value={item.muscleGroup} onChange={(event) => updatePastExercise(item.id, { muscleGroup: event.target.value })} placeholder="Back" /></div>
        <div className="field"><label>Sets</label><input type="number" min="1" step="1" value={item.setCount} onChange={(event) => updatePastExercise(item.id, { setCount: event.target.value })} /></div>
        <div className="field"><label>Reps</label><input type="number" min="0" step="1" value={item.reps} onChange={(event) => updatePastExercise(item.id, { reps: event.target.value })} /></div>
        <div className="field"><label>Weight kg</label><input type="number" min="0" step="0.5" value={item.weightKg} onChange={(event) => updatePastExercise(item.id, { weightKg: event.target.value })} /></div>
        <button className="danger-button" aria-label={`Remove ${item.name || 'exercise row'}`} onClick={() => setPastExercises((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button>
      </div>)}</div>
      <div className="past-form-actions"><button className="secondary-button" onClick={() => setPastExercises((current) => [...current, { ...initialPastExercise, id: createId() }])}><Plus size={16} />Add exercise</button><button className="primary-button" onClick={() => void savePastWorkout()}>Save workout</button></div>
    </section>}
    {conflicts.length > 0 && <section className="panel"><div className="panel-header"><h2>Workout sync conflicts</h2></div><p>Choose which version to keep for each workout.</p>{conflicts.map((item) => { const local = JSON.parse(item.payload) as Partial<Workout>; return <article className="exercise-card" key={item.id}><h3>{local.localDate ?? 'Workout'} · {(local.plannedFocus ?? []).join(' + ')}</h3><div style={{ display: 'flex', gap: 8 }}><button className="secondary-button" onClick={() => void resolveConflict(item, 'keep-local')}>Keep this device's version</button><button className="secondary-button" onClick={() => void resolveConflict(item, 'use-cloud')}>Use cloud version</button></div></article> })}{conflictMessage && <p role="status">{conflictMessage}</p>}</section>}
    <section className="panel">{workouts.length === 0 ? <div className="empty-state">Completed workouts will appear here.</div> : <table className="table"><thead><tr><th>Date</th><th>Focus</th><th>Place</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead><tbody>{workouts.map((workout) => <tr key={workout.id}><td>{workout.localDate}</td><td>{workout.plannedFocus.join(' + ')}</td><td>{workout.location ? workout.location[0].toUpperCase() + workout.location.slice(1) : '--'}</td><td>{workout.durationSeconds ? formatElapsed(workout.durationSeconds) : '--'}</td><td><span className="badge">Completed</span></td><td><div style={{ display: 'flex', gap: 6 }}><button className="secondary-button" onClick={() => void editWorkout(workout)}>Edit session</button><button className="danger-button" onClick={() => void deleteWorkout(workout)}>Delete</button></div></td></tr>)}</tbody></table>}</section>
  </div>
}

function LibraryPage() {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [custom, setCustom] = useState<Exercise[]>([])
  async function load() {
    const records = (await db.exercises.toArray()).filter((item) => !item.deletedAt)
    startTransition(() => setCustom(records))
  }
  useEffect(() => { void load() }, [])
  async function addExercise() {
    if (!customName.trim()) return
    const now = currentTimestamp()
    const item: Exercise = { id: createId(), name: customName.trim(), muscleGroups: [], equipment: '', exerciseType: 'strength', instructions: '', isCustom: true, createdAt: now, updatedAt: now, deletedAt: null }
    await db.exercises.add(item)
    await enqueue('exercises', item.id, item, 1)
    setCustomName('')
    await load()
  }
  const starter = ['Bench Press', 'Incline Dumbbell Press', 'Lat Pulldown', 'Barbell Row', 'Back Squat', 'Romanian Deadlift', 'Overhead Press', 'Triceps Pushdown', 'Cable Curl', 'Plank', 'Hanging Leg Raise']
  const items = [...starter, ...custom.map((item) => item.name)].filter((item, index, list) => list.indexOf(item) === index && item.toLowerCase().includes(search.toLowerCase()))
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Movement database</div><h1>Exercise library</h1></div></div><section className="panel"><div className="exercise-row"><div className="field"><label htmlFor="exercise-search">Search exercises</label><input id="exercise-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></div><div className="field"><label>Custom exercise</label><input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Exercise name" /></div><button className="primary-button" onClick={addExercise}><Plus size={16} />Add</button></div><div className="library-grid" style={{ marginTop: 16 }}>{items.map((item) => <article className="exercise-card" key={item}><h3>{item}</h3><p>Gym exercise</p><span className="badge">{custom.some((entry) => entry.name === item) ? 'Custom' : 'Starter library'}</span></article>)}</div></section></div>
}

function PlanPage() { return <div className="content"><div className="page-heading"><div><div className="eyebrow">Training structure</div><h1>Weekly plan</h1></div></div><section className="panel"><table className="table"><thead><tr><th>Day</th><th>Main weight training</th><th>Included</th></tr></thead><tbody>{weeklySplit.map((item) => <tr key={item.day}><td><strong>{item.day}</strong></td><td>{item.focus.join(' + ')}</td><td>{item.focus.includes('Rest') ? 'Recovery' : 'Cardio + Abs/Core + weights'}</td></tr>)}</tbody></table></section></div> }

function PhotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('Photos are private to this browser unless cloud backup is configured and you are signed in.')

  async function load() {
    if (supabase) {
      const session = await supabase.auth.getSession()
      if (session.data.session) {
        const { data: remotePhotos } = await supabase.from('progress_photos').select('*').is('deleted_at', null)
        for (const remote of remotePhotos ?? []) {
          const local = await db.progressPhotos.get(remote.id)
          if (local?.blob?.size) continue
          const downloaded = await supabase.storage.from('progress-photos').download(remote.storage_key)
          if (downloaded.error || !downloaded.data) continue
          await db.progressPhotos.put({
            id: remote.id,
            category: remote.category as ProgressPhoto['category'],
            capturedAt: remote.captured_at,
            note: remote.note,
            blob: downloaded.data,
            contentType: remote.content_type,
            storageKey: remote.storage_key,
            fileSizeBytes: remote.file_size_bytes,
            updatedAt: remote.updated_at,
            createdAt: remote.created_at,
            deletedAt: remote.deleted_at,
          })
        }
      }
    }
    const records = await db.progressPhotos.toArray()
    startTransition(() => setPhotos(records.filter((item) => !item.deletedAt).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))))
  }

  useEffect(() => { void load() }, [])
  useEffect(() => {
    const urls = Object.fromEntries(photos.filter((photo) => photo.blob instanceof Blob && photo.blob.size > 0).map((photo) => [photo.id, URL.createObjectURL(photo.blob)]))
    startTransition(() => setPhotoUrls(urls))
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }, [photos])

  async function upload(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setMessage('Photo exceeds the 15 MB storage limit.')
      return
    }
    const now = currentTimestamp()
    const photo: ProgressPhoto = { id: createId(), category: 'front', capturedAt: now, note: '', blob: file, contentType: file.type, createdAt: now, updatedAt: now, deletedAt: null }
    await db.progressPhotos.add(photo)
    if (supabase) {
      await enqueue('progressPhotos', photo.id, { ...photo, blob: undefined }, 1)
      const session = await supabase.auth.getSession()
      if (session.data.session) {
        const result = await syncNow()
        setMessage(result.status === 'synced' ? 'Photo saved locally and privately uploaded to cloud storage.' : 'Photo saved locally; cloud upload is queued for retry.')
      } else {
        setMessage('Photo saved locally. Sign in and sync to back it up privately.')
      }
    } else {
      setMessage('Photo saved locally and private to this browser.')
    }
    await load()
  }

  async function remove(photo: ProgressPhoto) {
    if (!window.confirm('Delete this progress photo?')) return
    const now = currentTimestamp()
    const deleted = { ...photo, deletedAt: now, updatedAt: now }
    await db.progressPhotos.put(deleted)
    if (supabase) {
      await enqueue('progressPhotos', photo.id, { ...deleted, blob: undefined }, 1, 'delete')
      const session = await supabase.auth.getSession()
      if (session.data.session) await syncNow()
    }
    await load()
  }

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Private gallery</div><h1>Progress photos</h1></div></div><section className="panel"><div className="field"><label htmlFor="photo-upload">Add progress photo</label><input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} /></div><p style={{ color: 'var(--muted)', marginTop: 10 }}>{message}</p><div className="library-grid" style={{ marginTop: 16 }}>{photos.map((photo) => <article className="exercise-card" key={photo.id}>{photoUrls[photo.id] && <img src={photoUrls[photo.id]} alt="Private progress photo" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 6 }} />}<p>{new Date(photo.capturedAt).toLocaleDateString()}</p><button className="danger-button" onClick={() => void remove(photo)}>Delete</button></article>)}</div></section></div>
}

function ProgressionPage() {
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [logs, setLogs] = useState<ReturnType<typeof getRecentStrengthLogs>>([])
  const [maxReps, setMaxReps] = useState(12)
  const [incrementKg, setIncrementKg] = useState(2.5)
  const [painOrPoorForm, setPainOrPoorForm] = useState(false)

  useEffect(() => {
    void (async () => {
      const [personalRecords, workouts, exercises, sets] = await Promise.all([
        db.personalRecords.toArray(), db.workouts.toArray(), db.workoutExercises.toArray(), db.workoutSets.toArray(),
      ])
      startTransition(() => {
        setRecords(getCurrentPersonalRecords(personalRecords))
        setLogs(getRecentStrengthLogs(workouts, exercises, sets))
      })
    })()
  }, [])

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Evidence-based progress</div><h1>PRs & Progression</h1></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-header"><h2>Personal records</h2></div>{records.length === 0 ? <div className="empty-state">Complete weighted sets to derive records. Nothing is fabricated.</div> : records.map((record) => <article className="exercise-card" key={record.id}><h3>{record.exerciseName}</h3><p>{record.type === 'estimated_1rm' ? 'Estimated 1RM (Epley)' : record.type.replaceAll('_', ' ')}</p><strong>{record.value} {record.unit}</strong></article>)}</section><section className="panel"><div className="panel-header"><h2>Next progression</h2></div><div className="exercise-row"><div className="field"><label htmlFor="progression-reps">Top of rep range</label><input id="progression-reps" type="number" min="1" max="30" value={maxReps} onChange={(event) => setMaxReps(Number(event.target.value))} /></div><div className="field"><label htmlFor="progression-increment">Load increment (kg)</label><input id="progression-increment" type="number" min="0.1" step="0.1" value={incrementKg} onChange={(event) => setIncrementKg(Number(event.target.value))} /></div></div><label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}><input type="checkbox" checked={painOrPoorForm} onChange={(event) => setPainOrPoorForm(event.target.checked)} />Pain or poor form reported</label>{logs.length === 0 ? <div className="empty-state">Complete weighted sets to see a progression recommendation.</div> : logs.map((log) => { const suggestion = getProgressionSuggestion({ ...log, maxReps, incrementKg, painOrPoorForm }); return <article className="exercise-card" key={log.workoutId + log.exerciseName}><h3>{log.exerciseName}</h3><p>Latest session: {new Date(log.performedAt).toLocaleDateString()} · {log.completedWorkingSets}/{log.prescribedWorkingSets} sets · reps {log.actualReps.join(', ') || 'none completed'}</p><strong>{suggestion.action}</strong><p style={{ color: 'var(--muted)' }}>{suggestion.reason}</p></article> })}<small>Suggestions use the latest completed workout only. Confirm any load change yourself.</small></section></div></div>
}

function MeasurementsPage() {
  const [items, setItems] = useState<Measurement[]>([])
  const [type, setType] = useState<Measurement['type']>('weight')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<'kg' | 'lb' | 'cm' | 'in'>('kg')
  async function load() {
    const records = (await db.measurements.toArray()).filter((item) => !item.deletedAt).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
    startTransition(() => setItems(records))
  }
  useEffect(() => { void load() }, [])
  async function add() {
    const number = Number(value)
    if (!value || !Number.isFinite(number) || number <= 0) return
    const now = currentTimestamp()
    const item: Measurement = { id: createId(), type, value: number, unit, measuredAt: now, note: '', createdAt: now, updatedAt: now, deletedAt: null }
    await db.measurements.add(item)
    await enqueue('measurements', item.id, item, 1)
    await load()
    setValue('')
  }
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Body tracking</div><h1>Measurements</h1></div></div><section className="panel"><div className="exercise-row"><div className="field"><label>Type</label><select value={type} onChange={(event) => setType(event.target.value as Measurement['type'])}><option value="weight">Weight</option><option value="waist">Waist</option><option value="chest">Chest</option><option value="shoulders">Shoulders</option><option value="arms">Arms</option><option value="thighs">Thighs</option><option value="hips">Hips</option><option value="custom">Custom</option></select></div><div className="field"><label>Value</label><input type="number" step="0.1" value={value} onChange={(event) => setValue(event.target.value)} /></div><div className="field"><label>Unit</label><select value={unit} onChange={(event) => setUnit(event.target.value as 'kg' | 'lb' | 'cm' | 'in')}><option>kg</option><option>lb</option><option>cm</option><option>in</option></select></div><button className="primary-button" onClick={add}><Plus size={16} />Add</button></div>{items.length === 0 ? <div className="empty-state">No measurements recorded.</div> : <table className="table"><thead><tr><th>Type</th><th>Value</th><th>Date</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.type}</td><td>{item.value} {item.unit}</td><td>{new Date(item.measuredAt).toLocaleDateString()}</td></tr>)}</tbody></table>}</section></div>
}

function GoalsPage() {
  const [items, setItems] = useState<Goal[]>([])
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  async function load() {
    const records = (await db.goals.toArray()).filter((item) => !item.deletedAt).sort((a, b) => b.startDate.localeCompare(a.startDate))
    startTransition(() => setItems(records))
  }
  useEffect(() => { void load() }, [])
  async function add() {
    const targetValue = Number(target)
    if (!name.trim() || !target || !Number.isFinite(targetValue)) return
    const now = currentTimestamp()
    const item: Goal = { id: createId(), name: name.trim(), targetValue, unit: '', startValue: 0, startDate: now.slice(0, 10), targetDate: null, status: 'active', createdAt: now, updatedAt: now, deletedAt: null }
    await db.goals.add(item)
    await enqueue('goals', item.id, item, 1)
    await load()
    setName('')
    setTarget('')
  }
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Targets</div><h1>Goals</h1></div></div><section className="panel"><div className="exercise-row"><div className="field"><label>Goal name</label><input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label>Target value</label><input type="number" value={target} onChange={(event) => setTarget(event.target.value)} /></div><button className="primary-button" onClick={add}><Plus size={16} />Add goal</button></div>{items.length === 0 ? <div className="empty-state">No goals created. Progress only comes from recorded values.</div> : items.map((goal) => <article className="exercise-card" key={goal.id}><h3>{goal.name}</h3><p>Target: {goal.targetValue} {goal.unit || 'units'}</p><span className="badge">{goal.status}</span></article>)}</section></div>
}

function ReportsPage() { const [workouts, setWorkouts] = useState<Workout[]>([]); const [cardio, setCardio] = useState<CardioEntry[]>([]); useEffect(() => { void (async () => { setWorkouts(await db.workouts.where('status').equals('completed').toArray()); setCardio(await db.cardioEntries.toArray()) })() }, []); const minutes = cardio.reduce((sum, entry) => sum + entry.durationSeconds / 60, 0); const distance = cardio.reduce((sum, entry) => sum + (entry.distanceMeters ?? 0) / 1000, 0); return <div className="content"><div className="page-heading"><div><div className="eyebrow">Performance</div><h1>Reports</h1></div></div><div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}><StatCard label="Completed sessions" value={`${workouts.length}`} suffix="recorded workouts" /><StatCard label="Cardio minutes" value={`${Math.round(minutes)}`} suffix="recorded entries" /><StatCard label="Cardio distance" value={distance ? `${distance.toFixed(1)} km` : '0 km'} suffix="actual entries" /><StatCard label="Data status" value={workouts.length || cardio.length ? 'Available' : 'Empty'} suffix="derived locally" /></div></div> }

function SettingsPage() { const [height, setHeight] = useState('180'); const [weight, setWeight] = useState('71'); const [goal, setGoal] = useState('Lean muscular and athletic physique'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [userEmail, setUserEmail] = useState<string | null>(null); const [syncMessage, setSyncMessage] = useState('Local mode'); useEffect(() => { void db.profiles.get('default').then((profile) => { if (profile) { setHeight(String(profile.heightCm)); setWeight(String(profile.weightKg)); setGoal(profile.goal) } }); if (supabase) void supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null)) }, []); async function saveProfile() { const profile = { id: 'default', heightCm: Number(height), weightKg: Number(weight), goal, weightUnit: 'kg' as const, distanceUnit: 'km' as const, targetMinutes: 135, theme: 'light' as const }; await db.profiles.put(profile); await enqueue('profiles', profile.id, profile, 1); setSyncMessage('Profile saved locally and queued') } async function signUp() { if (!supabase || !email || !password) return; const { error } = await supabase.auth.signUp({ email, password }); setSyncMessage(error?.message ?? 'Check email if confirmation is enabled') } async function signIn() { if (!supabase || !email || !password) return; const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setSyncMessage(error.message); else { setUserEmail(email); setSyncMessage('Signed in') } } async function signOut() { await supabase?.auth.signOut(); setUserEmail(null); setSyncMessage('Signed out; local data remains on this device') } async function sync() { const result = await syncNow(); setSyncMessage(result.status === 'synced' ? `${result.synced} item(s) synced` : result.status === 'offline' ? 'Offline: local changes are retained' : result.status === 'unconfigured' ? 'Cloud sync is not configured; local-only mode is active' : result.status === 'unauthenticated' ? 'Sign in before syncing' : 'Sync failed; local changes are retained') } return <div className="content"><div className="page-heading"><div><div className="eyebrow">Profile and preferences</div><h1>Settings</h1></div></div><section className="panel" style={{ maxWidth: 720 }}><div className="section-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}><div className="field"><label>Height (cm)</label><input type="number" value={height} onChange={(event) => setHeight(event.target.value)} /></div><div className="field"><label>Weight (kg)</label><input type="number" value={weight} onChange={(event) => setWeight(event.target.value)} /></div></div><div className="field" style={{ marginTop: 12 }}><label>Goal</label><input value={goal} onChange={(event) => setGoal(event.target.value)} /></div><button className="primary-button" style={{ marginTop: 16 }} onClick={saveProfile}>Save profile</button><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="secondary-button" onClick={exportJSON}>Export JSON backup</button><button className="secondary-button" onClick={exportCSV}>Export workout CSV</button><label className="secondary-button"><input type="file" accept="application/json" hidden onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); const parsed = validateBackup(text); if (!parsed.success) { setSyncMessage('Restore preview failed: invalid JSON or backup structure'); return } if (window.confirm(`Restore this backup containing ${parsed.data.workouts.length} workouts? Existing matching IDs will be updated.`)) { const result = await restoreBackup(text); setSyncMessage(result.restored ? result.reason : `Restore failed: ${result.reason}`) } }} />Restore JSON backup</label></div></section><section className="panel" style={{ maxWidth: 720, marginTop: 18 }}><div className="panel-header"><h2>Cloud account</h2><span className="badge">{supabaseConfigured ? 'Configured' : 'Local-only'}</span></div>{userEmail ? <><p>Signed in as <strong>{userEmail}</strong></p><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="secondary-button" onClick={sync}>Sync now</button><button className="danger-button" onClick={signOut}>Sign out</button></div></> : <>{supabase ? <><div className="field"><label>Email</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field" style={{ marginTop: 10 }}><label>Password</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="primary-button" onClick={signIn}>Sign in</button><button className="secondary-button" onClick={signUp}>Create account</button></div></> : <p>Supabase is not configured. The app remains fully usable locally.</p>}<button className="secondary-button" style={{ marginTop: 12 }} onClick={sync}>Sync now</button></>}<p style={{ color: 'var(--muted)', marginTop: 12 }}>{syncMessage}</p></section></div> }

export default App
