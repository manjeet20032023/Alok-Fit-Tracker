import { getPreviousMuscleGroupComparison, groupWorkoutsByDate, type WorkoutDayGroup } from './domain/workoutHistory'
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
import { validatePastWorkoutExercise, type PastWorkoutExerciseDraft, type PastWorkoutSetDraft } from './domain/pastWorkout'
import { filterExercises, getExerciseBodyPartTags, getExerciseCatalog, type ExerciseOption } from './domain/exerciseCatalog'
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
const initialPastExercise: PastWorkoutExerciseDraft = { id: 'initial', category: 'weight', name: '', muscleGroup: '', setCount: '3', reps: '10', weightKg: '0', durationSeconds: '', durationMinutes: '', distanceKm: '', speedKph: '', inclinePercent: '' }

function App() {
  return <BrowserRouter><Shell /></BrowserRouter>
}

function Shell() {
  const navigate = useNavigate()
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark"><Dumbbell size={19} /></span><span>Alok Fit</span></div><nav className="nav-list">{navItems.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `nav-button ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-bottom"><div className="online"><span className="online-dot" />Local-first storage ready</div></div></aside><main className="main"><header className="topbar"><div className="page-title">Alok Fit Tracker</div><div className="top-actions"><button className="avatar" aria-label="Profile settings" onClick={() => navigate('/settings')}><UserRound size={18} /></button></div></header><Routes><Route path="/" element={<Dashboard />} /><Route path="/workout" element={<WorkoutLogger />} /><Route path="/history" element={<HistoryPage />} /><Route path="/library" element={<LibraryPage />} /><Route path="/plan" element={<PlanPage />} /><Route path="/measurements" element={<MeasurementsPage />} /><Route path="/goals" element={<GoalsPage />} /><Route path="/photos" element={<PhotosPage />} /><Route path="/reports" element={<ReportsPage />} /><Route path="/progression" element={<ProgressionPage />} /><Route path="/settings" element={<SettingsPage />} /></Routes></main><nav className="bottom-nav" aria-label="Primary navigation">{navItems.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'active' : ''} title={label}><Icon size={19} /><span>{label}</span></NavLink>)}</nav></div>
}

function getWeekStart(date: Date) {
  const start = new Date(date.getTime())
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return localDate(start)
}

function Dashboard() {
  const navigate = useNavigate()
  const [today] = useState(() => currentTime())
  const [active, setActive] = useState<Workout | null>(null)
  const [completed, setCompleted] = useState<Workout[]>([])
  const [allCompleted, setAllCompleted] = useState<Workout[]>([])
  const [savedPlanDays, setSavedPlanDays] = useState<{ day: string; focus: string[] }[]>([])
  const [dashboardExercises, setDashboardExercises] = useState<WorkoutExercise[]>([])
  const [dashboardSets, setDashboardSets] = useState<WorkoutSet[]>([])
  const [dashboardCardio, setDashboardCardio] = useState<CardioEntry[]>([])
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' })
  const defaultPlan = weeklySplit.find((item) => item.day === weekday) ?? weeklySplit[0]
  const savedFocus = savedPlanDays.find((item) => item.day === weekday)?.focus
  const dayPlan = { day: weekday, focus: savedFocus?.length ? savedFocus : savedFocus ? ['Rest'] : defaultPlan.focus }
  useEffect(() => {
    void (async () => {
      const [activeWorkout, workouts, planDays, exercises, sets, cardio] = await Promise.all([
        db.workouts.where('status').anyOf(['in_progress', 'paused']).first(),
        db.workouts.where('status').equals('completed').reverse().sortBy('completedAt'),
        db.planDays.toArray(), db.workoutExercises.toArray(), db.workoutSets.toArray(), db.cardioEntries.toArray(),
      ])
      startTransition(() => {
        setActive(activeWorkout ?? null)
        setAllCompleted(workouts.filter((workout) => !workout.deletedAt))
        setCompleted(workouts.filter((workout) => !workout.deletedAt).slice(0, 5))
        setSavedPlanDays(planDays)
        setDashboardExercises(exercises)
        setDashboardSets(sets)
        setDashboardCardio(cardio)
      })
    })()
  }, [])

  const weekStart = getWeekStart(today)
  const currentWeek = allCompleted.filter((workout) => workout.localDate >= weekStart)
  const currentWeekIds = new Set(currentWeek.map((workout) => workout.id))
  const sessionsThisWeek = new Set(currentWeek.map((workout) => workout.localDate)).size
  const cardioMinutes = Math.round(dashboardCardio.filter((entry) => currentWeekIds.has(entry.workoutId)).reduce((sum, entry) => sum + entry.durationSeconds / 60, 0))
  const strengthVolume = Math.round(dashboardSets.filter((set) => currentWeekIds.has(set.workoutId) && set.completed && set.weightKg != null && set.reps != null).reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0))
  const focusGroups = dayPlan.focus.flatMap((focus) => focus.split(/[,+]/).map((tag) => tag.trim())).filter((group) => group && !['Rest', 'Cardio', 'Abs & Core', 'Core', 'Strength training'].includes(group))
  const previousByWorkout = new Map<string, { workout: Workout; muscleGroups: string[]; exercises: NonNullable<ReturnType<typeof getPreviousMuscleGroupComparison>>['exercises']; totalVolumeKg: number }>()
  for (const muscleGroup of focusGroups) {
    const comparison = getPreviousMuscleGroupComparison(allCompleted, dashboardExercises, dashboardSets, localDate(today), muscleGroup)
    if (!comparison) continue
    const current = previousByWorkout.get(comparison.workout.id)
    if (current) {
      current.muscleGroups.push(muscleGroup)
      current.exercises.push(...comparison.exercises)
      current.totalVolumeKg += comparison.totalVolumeKg
    } else {
      previousByWorkout.set(comparison.workout.id, { workout: comparison.workout, muscleGroups: [muscleGroup], exercises: [...comparison.exercises], totalVolumeKg: comparison.totalVolumeKg })
    }
  }
 // const previousFocusSessions = [...previousByWorkout.values()].sort((left, right) => right.workout.localDate.localeCompare(left.workout.localDate))
  const workoutGroups = groupWorkoutsByDate(allCompleted)

const latestDay =
  workoutGroups.length > 0
    ? workoutGroups[0]
    : null

const latestWorkoutIds = new Set(
  latestDay?.workouts.map(workout => workout.id) ?? []
)

const latestExercises = dashboardExercises.filter(exercise =>
  latestWorkoutIds.has(exercise.workoutId)
)

const latestCardio = dashboardCardio.filter(entry =>
  latestWorkoutIds.has(entry.workoutId)
)

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>Good morning, Alok</h1></div></div><div className="dashboard-grid"><section className="plan-card"><div><div className="eyebrow" style={{ color: '#d7ef6d' }}>Today's focus</div><h2>{dayPlan.focus.join(' + ')}</h2><p>{dayPlan.focus.includes('Rest') ? 'Recovery day. Rest, mobility and a routine of your choice.' : `Cardio • Abs & Core • ${dayPlan.focus.join(' + ')}`}</p></div>{active ? <button className="primary-button" onClick={() => navigate('/workout')}><Play size={17} />Resume workout</button> : dayPlan.focus.includes('Rest') ? <button className="secondary-button" onClick={() => navigate('/plan')}>View weekly plan</button> : <button className="primary-button" onClick={() => navigate('/workout')}><Plus size={17} />Start workout</button>}</section><div className="stat-grid"><StatCard label="Training days" value={`${sessionsThisWeek}`} suffix="this week" /><StatCard label="Strength volume" value={`${strengthVolume.toLocaleString()} kg`} suffix="sets × weight × reps" /><StatCard label="Cardio time" value={`${cardioMinutes} min`} suffix="this week" /><StatCard label="Target" value="120–150" suffix="minutes per week" /></div></div><section className="panel" style={{ marginTop: 18 }}><div className="panel-header"><h2>Last workout {latestDay ? `· ${latestDay.localDate}` : ''}</h2><button className="secondary-button" onClick={() => navigate('/history')}>View history</button></div>{!latestDay ? <div className="empty-state">Your completed sessions and exercise details will appear here.</div> : <><p className="latest-workout-focus">{latestDay.focus.join(' + ')} · {latestDay.locations.join(', ') || 'Location not set'} · {formatElapsed(latestDay.durationSeconds)}</p><div className="latest-exercise-list">{latestExercises.map((exercise) => { const exerciseSets = dashboardSets.filter((set) => set.workoutExerciseId === exercise.id); return <div className="latest-exercise-row" key={exercise.id}><strong>{exercise.name}</strong><span className="badge">{exercise.muscleGroup}</span><span>{exerciseSets.map((set) => `S${set.setNumber}: ${set.reps ?? '-'} reps × ${set.weightKg ?? set.durationSeconds ?? '-'} ${exercise.section === 'core' ? 'sec' : 'kg'}`).join(' · ')}</span></div> })}{latestCardio.map((entry) => <div className="latest-exercise-row" key={entry.id}><strong>{entry.activityType}</strong><span className="badge">Cardio</span><span>{Math.round(entry.durationSeconds / 60)} min{entry.speedKph != null ? ` · ${entry.speedKph} km/h` : ''}{entry.distanceMeters != null ? ` · ${(entry.distanceMeters / 1000).toFixed(1)} km` : ''}</span></div>)}</div></>}</section><section className="panel" style={{ marginTop: 18 }}><div className="panel-header"><h2>Recent training days</h2></div>{completed.length === 0 ? <div className="empty-state">No completed workouts yet.</div> : <table className="table"><thead><tr><th>Date</th><th>Focus</th><th>Duration</th></tr></thead><tbody>{groupWorkoutsByDate(completed).map((day) => <tr key={day.localDate}><td>{day.localDate}</td><td>{day.focus.join(' + ')}</td><td>{formatElapsed(day.durationSeconds)}</td></tr>)}</tbody></table>}</section></div>
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) { return <article className="stat-card"><span className="label">{label}</span><strong>{value}</strong><small>{suffix}</small></article> }

function WorkoutLogger() {
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [section, setSection] = useState<'cardio' | 'core' | 'weight'>('cardio')
  const [now, setNow] = useState(() => currentTime())
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [cardio, setCardio] = useState<CardioEntry[]>([])
  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([])
  const [previousPerformance, setPreviousPerformance] = useState<NonNullable<ReturnType<typeof getPreviousMuscleGroupComparison>>[]>([])
  const [bodyPartFilter, setBodyPartFilter] = useState('All')
  const [selectedCardioName, setSelectedCardioName] = useState('Treadmill running')
  const [selectedExerciseName, setSelectedExerciseName] = useState('')
  const [finishOpen, setFinishOpen] = useState(false)
  const [restSeconds, setRestSeconds] = useState(90)
  const [restRunning, setRestRunning] = useState(false)
  useEffect(() => { if (!restRunning) return; const timer = window.setInterval(() => setRestSeconds((value) => { if (value <= 1) { setRestRunning(false); return 0 } return value - 1 }), 1000); return () => window.clearInterval(timer) }, [restRunning])
  async function load() { const active = await db.workouts.where('status').anyOf(['in_progress', 'paused']).first(); if (active) await open(active) }
  async function open(value: Workout) { setWorkout(value); await refresh(value.id) }
  async function refresh(workoutId: string) { setExercises(await db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order')); setSets(await db.workoutSets.where('workoutId').equals(workoutId).toArray()); setCardio(await db.cardioEntries.where('workoutId').equals(workoutId).toArray()) }
  useEffect(() => { void db.exercises.toArray().then((items) => startTransition(() => setLibraryExercises(items))) }, [])
  useEffect(() => { void load(); const clock = window.setInterval(() => setNow(currentTime()), 1000); return () => window.clearInterval(clock) }, [])
  useEffect(() => {
    if (!workout) return
    void (async () => {
      const [completedWorkouts, loggedExercises, loggedSets] = await Promise.all([
        db.workouts.where('status').equals('completed').toArray(), db.workoutExercises.toArray(), db.workoutSets.toArray(),
      ])
      const comparisons = workout.plannedFocus
        .flatMap((group) => group.split(/[,+]/).map((tag) => tag.trim()))
        .filter((group) => group && group !== 'Rest' && group !== 'Training' && group !== 'Strength training')
        .map((group) => getPreviousMuscleGroupComparison(completedWorkouts, loggedExercises, loggedSets, workout.localDate, group))
        .filter((comparison): comparison is NonNullable<typeof comparison> => comparison != null)
      startTransition(() => setPreviousPerformance(comparisons))
    })()
  }, [workout?.id])
  async function start() { const date = currentTime(); const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }); const focus = (await db.planDays.get(weekday))?.focus ?? weeklySplit.find((item) => item.day === weekday)?.focus ?? ['Training']; if (!focus.length || focus.includes('Rest')) return; const value: Workout = { id: createId(), localDate: localDate(date), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, plannedFocus: focus, status: 'in_progress', startedAt: date.toISOString(), pausedAt: null, lastResumedAt: date.toISOString(), totalPausedSeconds: 0, completedAt: null, durationSeconds: null, notes: '', createdAt: date.toISOString(), updatedAt: date.toISOString(), revision: 1, deletedAt: null }; await db.workouts.add(value); await enqueue('workouts', value.id, value, value.revision); await open(value) }
  async function pauseResume() { if (!workout) return; const date = currentTime(); let next: Workout; if (workout.status === 'in_progress') next = { ...workout, status: 'paused', pausedAt: date.toISOString(), updatedAt: date.toISOString(), revision: workout.revision + 1 }; else { const pausedAt = Date.parse(workout.pausedAt ?? date.toISOString()); const added = Math.max(0, Math.floor((date.getTime() - pausedAt) / 1000)); next = { ...workout, status: 'in_progress', pausedAt: null, lastResumedAt: date.toISOString(), totalPausedSeconds: workout.totalPausedSeconds + added, updatedAt: date.toISOString(), revision: workout.revision + 1 } } await db.workouts.put(next); await enqueue('workouts', next.id, next, next.revision); setWorkout(next); setNow(date) }
  async function finish() { if (!workout) return; const finished = currentTime(); let totalPausedSeconds = workout.totalPausedSeconds; if (workout.status === 'paused' && workout.pausedAt) totalPausedSeconds += Math.max(0, Math.floor((finished.getTime() - Date.parse(workout.pausedAt)) / 1000)); const durationSeconds = calculateElapsedSeconds({ ...workout, status: 'completed', totalPausedSeconds, completedAt: finished.toISOString() }, finished); const next: Workout = { ...workout, status: 'completed', pausedAt: null, totalPausedSeconds, completedAt: finished.toISOString(), durationSeconds, updatedAt: finished.toISOString(), revision: workout.revision + 1 }; await db.workouts.put(next); await enqueue('workouts', next.id, next, next.revision); const strengthLogs = exercises.filter((exercise) => exercise.section === 'weight').map((exercise) => ({ exerciseId: exercise.id, exerciseName: exercise.name, workoutId: workout.id, achievedAt: finished.toISOString(), sets: sets.filter((set) => set.workoutExerciseId === exercise.id) })); const records = derivePersonalRecords(strengthLogs); if (records.length) { await db.personalRecords.bulkPut(records); for (const record of records) await enqueue('personalRecords', record.id, record, 1) } setWorkout(null); setFinishOpen(false) }
  async function addExercise(exerciseSection: 'weight' | 'core' | 'cardio', name: string, muscle: string) { if (!workout || exerciseSection === 'cardio' || exercises.some((item) => item.section === exerciseSection && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return; const exercise: WorkoutExercise = { id: createId(), workoutId: workout.id, name, muscleGroup: muscle, section: exerciseSection, order: exercises.filter((item) => item.section === exerciseSection).length }; await db.workoutExercises.add(exercise); await enqueue('workoutExercises', exercise.id, exercise, 1); const set: WorkoutSet = { id: createId(), workoutExerciseId: exercise.id, workoutId: workout.id, setNumber: 1, reps: exerciseSection === 'core' ? null : 10, weightKg: exerciseSection === 'core' ? null : 0, durationSeconds: exerciseSection === 'core' ? 30 : null, completed: false, notes: '' }; await db.workoutSets.add(set); await enqueue('workoutSets', set.id, set, 1); await refresh(workout.id) }
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
  async function addCardio() { if (!workout) return; const entry: CardioEntry = { id: createId(), workoutId: workout.id, activityType: selectedCardioName, durationSeconds: 0, distanceMeters: null, speedKph: null, inclinePercent: null, heartRate: null, calories: null, notes: '' }; await db.cardioEntries.add(entry); await enqueue('cardioEntries', entry.id, entry, 1); await refresh(workout.id) }
  async function updateCardio(entry: CardioEntry, patch: Partial<CardioEntry>) { const next = { ...entry, ...patch }; await db.cardioEntries.put(next); await enqueue('cardioEntries', next.id, next, 1); if (workout) await refresh(workout.id) }

  if (!workout) return <div className="content"><div className="page-heading"><div><div className="eyebrow">Live session</div><h1>Workout logger</h1></div></div><section className="panel"><div className="empty-state"><Dumbbell size={28} /><p>No active workout.</p><button className="primary-button" onClick={start}>Start today's workout</button></div></section></div>
  const elapsed = calculateElapsedSeconds(workout, now)
  const visible = exercises.filter((item) => item.section === (section === 'core' ? 'core' : 'weight'))
  const exerciseCatalog = getExerciseCatalog(libraryExercises)
  const catalogSection = section === 'cardio' ? 'cardio' : section === 'core' ? 'core' : 'weight'
  const availableBodyParts = getExerciseBodyPartTags(exerciseCatalog, catalogSection)
  const availableExercises = filterExercises(exerciseCatalog, catalogSection, bodyPartFilter)
  const availableCardioActivities = filterExercises(exerciseCatalog, 'cardio', bodyPartFilter)
  const preferredExerciseName = section === 'core' ? 'Plank' : workout.plannedFocus.includes('Back') ? 'Lat Pulldown' : workout.plannedFocus.includes('Legs') ? 'Back Squat' : 'Bench Press'
  const selectedExercise = availableExercises.find((item) => item.name === selectedExerciseName) ?? availableExercises.find((item) => item.name === preferredExerciseName)
 return <div className="content"><div className="page-heading"><div><div className="eyebrow">{workout.localDate}</div><h1>{workout.plannedFocus.join(' + ')}</h1></div><button className="danger-button" onClick={() => setFinishOpen(true)}>Finish workout</button></div><div className="workout-layout"><div><section className="timer-panel"><div><div className="eyebrow" style={{ color: '#d7ef6d' }}>{workout.status === 'paused' ? 'Workout paused' : 'Workout in progress'}</div><div className="timer">{formatElapsed(elapsed)}</div></div><button className="secondary-button" onClick={pauseResume}>{workout.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}{workout.status === 'paused' ? 'Resume workout' : 'Pause workout'}</button></section><PreviousWorkoutReference comparisons={previousPerformance} focus={workout.plannedFocus} /><div className="workout-filters" style={{ marginTop: 14 }}><label className="field"><span>Category</span><select value={section} onChange={(event) => { setSection(event.target.value as 'cardio' | 'core' | 'weight'); setBodyPartFilter('All') }}><option value="weight">Strength</option><option value="core">Abs & Core</option><option value="cardio">Cardio</option></select></label><label className="field"><span>Body part</span><select value={bodyPartFilter} onChange={(event) => setBodyPartFilter(event.target.value)}><option>All</option>{availableBodyParts.map((tag) => <option key={tag}>{tag}</option>)}</select></label></div><section className="panel">{section === 'cardio' ? <><div className="panel-header"><h2>Cardio</h2><div className="exercise-add"><label className="field"><span>Activity</span><select value={selectedCardioName} onChange={(event) => setSelectedCardioName(event.target.value)}>{availableCardioActivities.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.muscleGroup}</option>)}</select></label><button className="secondary-button" onClick={addCardio}><Plus size={16} />Add cardio</button></div></div>{cardio.length === 0 ? <div className="empty-state">Add a cardio activity when you have logged one.</div> : cardio.map((entry) => <div className="exercise-row cardio-entry-row" key={entry.id}><div className="field"><label>Activity</label><select value={entry.activityType} onChange={(event) => void updateCardio(entry, { activityType: event.target.value })}>{availableCardioActivities.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.muscleGroup}</option>)}</select></div><div className="field"><label>Minutes</label><input type="number" min="0" value={entry.durationSeconds ? Math.round(entry.durationSeconds / 60) : ''} onChange={(event) => void updateCardio(entry, { durationSeconds: Number(event.target.value || 0) * 60 })} /></div><div className="field"><label>Speed km/h</label><input type="number" min="0" step="0.1" value={entry.speedKph ?? ''} onChange={(event) => void updateCardio(entry, { speedKph: event.target.value === '' ? null : Number(event.target.value) })} /></div><div className="field"><label>Distance km</label><input type="number" min="0" step="0.01" value={entry.distanceMeters ? Math.round(entry.distanceMeters / 10) / 100 : ''} onChange={(event) => void updateCardio(entry, { distanceMeters: event.target.value === '' ? null : Number(event.target.value) * 1000 })} /></div><div className="field"><label>Incline %</label><input type="number" min="0" step="0.5" value={entry.inclinePercent ?? ''} onChange={(event) => void updateCardio(entry, { inclinePercent: event.target.value === '' ? null : Number(event.target.value) })} /></div></div>)}</> : <><div className="panel-header exercise-panel-header"><h2>{section === 'core' ? 'Abs & Core' : workout.plannedFocus.join(' + ')}</h2><div className="exercise-add"><label className="field"><span>Exercise</span><select value={selectedExercise?.name ?? ''} onChange={(event) => setSelectedExerciseName(event.target.value)}><option value="">Choose exercise</option>{availableExercises.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.muscleGroup}</option>)}</select></label><button className="primary-button" disabled={!selectedExercise || visible.some((item) => item.name === selectedExercise.name)} onClick={() => selectedExercise && void addExercise(selectedExercise.section, selectedExercise.name, selectedExercise.muscleGroup)}><Plus size={16} />Add exercise</button></div></div>{visible.length === 0 ? <div className="empty-state">No {section === 'core' ? 'core' : 'weight'} exercises added yet.</div> : visible.map((exercise) => <article className="logged-exercise" key={exercise.id}><div className="logged-exercise-title"><strong>{exercise.name}</strong> <span className="badge">{exercise.muscleGroup}</span><button className="danger-button" onClick={() => void removeExercise(exercise)}>Remove exercise</button></div>{sets.filter((set) => set.workoutExerciseId === exercise.id).map((set) => <div className="exercise-row" key={set.id}><div className="field"><label>Set {set.setNumber}</label><input aria-label={`${exercise.name} set ${set.setNumber} reps`} type="number" min="0" value={set.reps ?? ''} onChange={(event) => void updateSet(set, { reps: event.target.value === '' ? null : Number(event.target.value) })} /></div><div className="field"><label>{exercise.section === 'core' ? 'Seconds' : 'Weight kg'}</label><input type="number" min="0" step="0.5" value={exercise.section === 'core' ? set.durationSeconds ?? '' : set.weightKg ?? ''} onChange={(event) => void updateSet(set, exercise.section === 'core' ? { durationSeconds: event.target.value === '' ? null : Number(event.target.value) } : { weightKg: event.target.value === '' ? null : Number(event.target.value) })} /></div><div /><button aria-label={`Mark set ${set.setNumber} complete`} className={`check-button ${set.completed ? 'done' : ''}`} onClick={() => void updateSet(set, { completed: !set.completed })}>{set.completed ? <Check size={17} /> : null}</button></div>)}<button className="secondary-button" onClick={() => void addSet(exercise.id)}><Plus size={15} />Add set</button></article>)}</>}</section></div><aside className="rest-panel"><h3>Rest timer</h3><div className="rest-display">{formatElapsed(restSeconds).slice(3)}</div><div className="preset-grid">{[30,60,90,120,180].map((seconds) => <button key={seconds} onClick={() => { setRestSeconds(seconds); setRestRunning(false) }}>{seconds}s</button>)}</div><button className="primary-button" style={{ width: '100%' }} onClick={() => setRestRunning((running) => !running)}>{restRunning ? <Pause size={16} /> : <Play size={16} />}{restRunning ? 'Pause' : 'Start timer'}</button><button className="secondary-button" style={{ width: '100%', marginTop: 8 }} onClick={() => { setRestRunning(false); setRestSeconds(90) }}>Reset</button><p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>Rest between sets counts toward workout duration.</p></aside></div>{finishOpen && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><h2>Finish workout?</h2><p>This saves the session duration and moves it to history. Workout entries remain editable later.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setFinishOpen(false)}>Continue workout</button><button className="primary-button" onClick={finish}>Confirm finish</button></div></div></div>}</div>
}

type PreviousFocusSession =
  NonNullable<
    ReturnType<typeof getPreviousMuscleGroupComparison>
  >
function PreviousWorkoutReference({ comparisons, focus }: { comparisons: PreviousFocusSession[]; focus: string[] }) {
  if (!comparisons.length) return null
  return <section className="panel previous-workout-reference"><div className="panel-header"><h2>Previous {focus.join(' + ')} workout</h2></div><p>Compare with your last session for these muscle groups. Match or improve only with solid form; stop if you feel pain.</p>{comparisons.map((comparison) => <div className="comparison-group" key={comparison.workout.id}><div className="comparison-heading"><strong>{focus.join(' + ')}</strong><span>{comparison.workout.localDate} · {formatElapsed(comparison.workout.durationSeconds ?? 0)}</span></div>{comparison.exercises.map((exercise) => <div className="comparison-exercise" key={`${comparison.workout.id}-${exercise.exerciseName}`}><strong>{exercise.exerciseName} <span className="badge">{exercise.muscleGroup}</span></strong><span>{exercise.sets.map((set) => `Set ${set.setNumber}: ${set.reps ?? '-'} reps × ${set.weightKg ?? '-'} kg`).join(' · ')}</span></div>)}<small>Total completed volume: {comparison.totalVolumeKg.toLocaleString()} kg</small></div>)}</section>
}

function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [historyExercises, setHistoryExercises] = useState<WorkoutExercise[]>([])
  const [historySets, setHistorySets] = useState<WorkoutSet[]>([])
  const [historyCardio, setHistoryCardio] = useState<CardioEntry[]>([])
  const [conflicts, setConflicts] = useState<SyncOutboxItem[]>([])
  const [conflictMessage, setConflictMessage] = useState('')
  const [pastEntryOpen, setPastEntryOpen] = useState(false)
  const [pastDate, setPastDate] = useState(localDate())
  const [pastStartTime, setPastStartTime] = useState('18:00')
  const [pastEndTime, setPastEndTime] = useState('19:00')
  const [pastLocation, setPastLocation] = useState<NonNullable<Workout['location']>>('gym')
    const [editingDate, setEditingDate] = useState<string | null>(null)
  const [pastNotes, setPastNotes] = useState('')
  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([])
  const [pastExercises, setPastExercises] = useState<PastWorkoutExerciseDraft[]>([initialPastExercise])
  const [pastBodyPartFilters, setPastBodyPartFilters] = useState<Record<string, string>>({})
  const [pastMessage, setPastMessage] = useState('')
  async function load() {
    const [workouts, conflicts, libraryExercises, exercises, sets, cardio] = await Promise.all([
      db.workouts.where('status').equals('completed').reverse().sortBy('completedAt'),
      db.syncOutbox.where('status').equals('conflict').toArray(),
      db.exercises.toArray(),
      db.workoutExercises.toArray(),
      db.workoutSets.toArray(),
      db.cardioEntries.toArray(),
    ])
    startTransition(() => {
      setWorkouts(workouts.filter((workout) => !workout.deletedAt))
      setConflicts(conflicts)
      setLibraryExercises(libraryExercises.filter((item) => !item.deletedAt))
      setHistoryExercises(exercises)
      setHistorySets(sets)
      setHistoryCardio(cardio)
    })
  }
  useEffect(() => { void load() }, [])
  const workoutDays = groupWorkoutsByDate(workouts)
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
  function toTimeInput(value: string) {
    return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  function editWorkoutDay(day: WorkoutDayGroup) {
    const firstWorkout = [...day.workouts].sort((left, right) => left.startedAt.localeCompare(right.startedAt))[0]
    const lastWorkout = [...day.workouts].sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0]
    const workoutIds = new Set(day.workouts.map((workout) => workout.id))
    const drafts: PastWorkoutExerciseDraft[] = historyExercises.filter((item) => workoutIds.has(item.workoutId)).map((exercise) => {
      const exerciseSets = historySets.filter((set) => set.workoutExerciseId === exercise.id)
      const firstSet = exerciseSets[0]
      return {
        ...initialPastExercise, id: createId(), category: exercise.section, name: exercise.name, muscleGroup: exercise.muscleGroup,
        setCount: String(Math.max(1, exerciseSets.length)), reps: firstSet?.reps == null ? '' : String(firstSet.reps),
        weightKg: firstSet?.weightKg == null ? '' : String(firstSet.weightKg),
        durationSeconds: firstSet?.durationSeconds == null ? '' : String(firstSet.durationSeconds),
        setValues: exerciseSets.map((set) => ({
          reps: set.reps == null ? '' : String(set.reps),
          weightKg: set.weightKg == null ? '' : String(set.weightKg),
          durationSeconds: set.durationSeconds == null ? '' : String(set.durationSeconds),
        })),
      }
    })
    for (const entry of historyCardio.filter((item) => workoutIds.has(item.workoutId))) {
      drafts.push({
        ...initialPastExercise, id: createId(), category: 'cardio', name: entry.activityType, muscleGroup: 'Cardio',
        setCount: '', reps: '', weightKg: '', durationMinutes: String(entry.durationSeconds / 60),
        speedKph: entry.speedKph == null ? '' : String(entry.speedKph),
        distanceKm: entry.distanceMeters == null ? '' : String(entry.distanceMeters / 1000),
        inclinePercent: entry.inclinePercent == null ? '' : String(entry.inclinePercent),
      })
    }
    setEditingDate(day.localDate)
    setPastDate(day.localDate)
    setPastStartTime(toTimeInput(firstWorkout.startedAt))
    setPastEndTime(toTimeInput(lastWorkout.completedAt ?? firstWorkout.startedAt))
    setPastLocation((day.locations[0] ?? 'gym') as NonNullable<Workout['location']>)
    setPastExercises(drafts.length ? drafts : [initialPastExercise])
    setPastNotes([...new Set(day.workouts.map((workout) => workout.notes.trim()).filter((notes) => notes && notes !== 'Logged after training'))].join('\n'))
    setPastEntryOpen(true)
    setPastMessage('')
  }
  async function deleteWorkoutDay(day: WorkoutDayGroup) {
    if (!window.confirm(`Delete all completed workouts for ${day.localDate}?`)) return
    const now = currentTimestamp()
    const deleted = day.workouts.map((workout) => ({ ...workout, deletedAt: now, updatedAt: now, revision: workout.revision + 1 }))
    await db.workouts.bulkPut(deleted)
    for (const workout of deleted) await enqueue('workouts', workout.id, workout, workout.revision, 'delete')
    await load()
  }
  function updatePastExercise(id: string, patch: Partial<PastWorkoutExerciseDraft>) {
    setPastExercises((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }
  function updatePastSet(exerciseId: string, setIndex: number, patch: Partial<PastWorkoutSetDraft>) {
    setPastExercises((current) => current.map((item) => item.id !== exerciseId || !item.setValues
      ? item
      : { ...item, setValues: item.setValues.map((set, index) => index === setIndex ? { ...set, ...patch } : set) }))
  }
  function addPastSet(item: PastWorkoutExerciseDraft) {
    const values = item.setValues ?? Array.from({ length: Number(item.setCount) }, () => ({ reps: item.reps, weightKg: item.weightKg, durationSeconds: item.durationSeconds }))
    const previous = values.at(-1) ?? { reps: '', weightKg: '', durationSeconds: '' }
    updatePastExercise(item.id, { setValues: [...values, { ...previous }], setCount: String(values.length + 1) })
  }
  function removePastSet(item: PastWorkoutExerciseDraft, setIndex: number) {
    const values = item.setValues ?? []
    if (values.length <= 1) return
    const setValues = values.filter((_, index) => index !== setIndex)
    updatePastExercise(item.id, { setValues, setCount: String(setValues.length) })
  }
  async function savePastWorkout() {
    const start = new Date(`${pastDate}T${pastStartTime}:00`)
    const end = new Date(`${pastDate}T${pastEndTime}:00`)
    const drafts = pastExercises.filter((item) => item.name.trim())
    const inferredFocus = [...new Set(drafts.flatMap((item) => item.category === 'cardio' ? ['Cardio'] : item.category === 'core' ? ['Abs & Core'] : item.muscleGroup.split(',').map((tag) => tag.trim()).filter(Boolean)))]
    const focus = inferredFocus
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      setPastMessage('Enter a valid date and an end time after the start time.')
      return
    }
    const validationMessage = drafts.map(validatePastWorkoutExercise).find(Boolean)
    if (!focus.length || !drafts.length || validationMessage) {
      setPastMessage(validationMessage ?? 'Add a workout focus and at least one exercise or activity.')
      return
    }

    const oldWorkouts = editingDate ? workouts.filter((workout) => workout.localDate === editingDate) : []
    const oldWorkoutIds = new Set(oldWorkouts.map((workout) => workout.id))
    const oldExercises = historyExercises.filter((exercise) => oldWorkoutIds.has(exercise.workoutId))
    const oldExerciseIds = new Set(oldExercises.map((exercise) => exercise.id))
    const oldSets = historySets.filter((set) => oldExerciseIds.has(set.workoutExerciseId))
    const oldCardio = historyCardio.filter((entry) => oldWorkoutIds.has(entry.workoutId))
    const oldPersonalRecords = (await db.personalRecords.toArray()).filter((record) => record.workoutId && oldWorkoutIds.has(record.workoutId))
    const now = currentTimestamp()
    const workout: Workout = {
      id: createId(), localDate: pastDate, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      plannedFocus: focus, location: pastLocation, status: 'completed', startedAt: start.toISOString(), pausedAt: null,
      lastResumedAt: start.toISOString(), totalPausedSeconds: 0, completedAt: end.toISOString(),
      durationSeconds: Math.floor((end.getTime() - start.getTime()) / 1000), notes: pastNotes,
      createdAt: now, updatedAt: now, revision: 1, deletedAt: null,
    }
    const trainingDrafts = drafts.filter((draft) => draft.category !== 'cardio')
    const exercises: WorkoutExercise[] = trainingDrafts.map((draft, order) => ({
      id: createId(), workoutId: workout.id, name: draft.name.trim(), muscleGroup: draft.muscleGroup.trim(), section: draft.category === 'core' ? 'core' : 'weight', order,
    }))
    const sets: WorkoutSet[] = trainingDrafts.flatMap((draft, index) => {
      const setValues = draft.setValues ?? Array.from({ length: Number(draft.setCount) }, () => ({ reps: draft.reps, weightKg: draft.weightKg, durationSeconds: draft.durationSeconds }))
      return setValues.map((set, setIndex) => ({
        id: createId(), workoutExerciseId: exercises[index].id, workoutId: workout.id, setNumber: setIndex + 1,
        reps: set.reps === '' ? null : Number(set.reps), weightKg: draft.category === 'weight' && set.weightKg !== '' ? Number(set.weightKg) : null,
        durationSeconds: draft.category === 'core' && set.durationSeconds !== '' ? Number(set.durationSeconds) : null, completed: true, notes: '',
      }))
    })
    const cardioEntries: CardioEntry[] = drafts.filter((draft) => draft.category === 'cardio').map((draft) => ({
      id: createId(), workoutId: workout.id, activityType: draft.name.trim(), durationSeconds: Number(draft.durationMinutes) * 60,
      distanceMeters: draft.distanceKm === '' ? null : Number(draft.distanceKm) * 1000,
      speedKph: draft.speedKph === '' ? null : Number(draft.speedKph),
      inclinePercent: draft.inclinePercent === '' ? null : Number(draft.inclinePercent), heartRate: null, calories: null, notes: '',
    }))
    await db.transaction('rw', [db.workouts, db.workoutExercises, db.workoutSets, db.cardioEntries, db.personalRecords], async () => {
      if (oldWorkouts.length) await db.workouts.bulkDelete([...oldWorkoutIds])
      if (oldExercises.length) await db.workoutExercises.bulkDelete(oldExercises.map((item) => item.id))
      if (oldSets.length) await db.workoutSets.bulkDelete(oldSets.map((item) => item.id))
      if (oldCardio.length) await db.cardioEntries.bulkDelete(oldCardio.map((item) => item.id))
      if (oldPersonalRecords.length) await db.personalRecords.bulkDelete(oldPersonalRecords.map((item) => item.id))
      await db.workouts.add(workout)
      if (exercises.length) await db.workoutExercises.bulkAdd(exercises)
      if (sets.length) await db.workoutSets.bulkAdd(sets)
      if (cardioEntries.length) await db.cardioEntries.bulkAdd(cardioEntries)
    })
    for (const oldWorkout of oldWorkouts) await enqueue('workouts', oldWorkout.id, oldWorkout, oldWorkout.revision + 1, 'delete')
    for (const oldExercise of oldExercises) await enqueue('workoutExercises', oldExercise.id, oldExercise, oldExercise.revision ?? 1, 'delete')
    for (const oldSet of oldSets) await enqueue('workoutSets', oldSet.id, oldSet, oldSet.revision ?? 1, 'delete')
    for (const oldEntry of oldCardio) await enqueue('cardioEntries', oldEntry.id, oldEntry, oldEntry.revision ?? 1, 'delete')
    for (const oldRecord of oldPersonalRecords) await enqueue('personalRecords', oldRecord.id, oldRecord, 1, 'delete')
    await enqueue('workouts', workout.id, workout, workout.revision)
    for (const exercise of exercises) await enqueue('workoutExercises', exercise.id, exercise, 1)
    for (const set of sets) await enqueue('workoutSets', set.id, set, 1)
    for (const entry of cardioEntries) await enqueue('cardioEntries', entry.id, entry, 1)
    const records = derivePersonalRecords(exercises.filter((exercise) => exercise.section === 'weight').map((exercise) => ({
      exerciseId: exercise.id, exerciseName: exercise.name, workoutId: workout.id, achievedAt: workout.completedAt!,
      sets: sets.filter((set) => set.workoutExerciseId === exercise.id),
    })))
    if (records.length) {
      await db.personalRecords.bulkPut(records)
      for (const record of records) await enqueue('personalRecords', record.id, record, 1)
    }
    setPastMessage(editingDate ? 'Workout day updated.' : 'Past workout saved.')
    setPastEntryOpen(false)
    setEditingDate(null)
    setPastNotes('')
    setPastDate(localDate())
    setPastExercises([initialPastExercise])
    await load()
  }
  const pastExerciseOptions = getExerciseCatalog(libraryExercises)
  return <div className="content">
    <div className="page-heading"><div><div className="eyebrow">Training log</div><h1>Workout history</h1></div><button className="primary-button" onClick={() => setPastEntryOpen((open) => !open)}>{pastEntryOpen ? 'Close form' : 'Log past workout'}</button></div>
    {pastMessage && <p className="status-message" role="status">{pastMessage}</p>}
    {pastEntryOpen && <section className="panel past-workout-form">
      <div className="panel-header"><h2>{editingDate ? `Edit workout · ${editingDate}` : 'Workout details'}</h2></div>
      <div className="past-workout-grid">
        <div className="field"><label htmlFor="past-date">Date</label><input id="past-date" type="date" value={pastDate} onChange={(event) => setPastDate(event.target.value)} /></div>
        <div className="field"><label htmlFor="past-location">Location</label><select id="past-location" value={pastLocation} onChange={(event) => setPastLocation(event.target.value as NonNullable<Workout['location']>)}><option value="gym">Gym</option><option value="home">Home</option><option value="other">Other</option></select></div>
        <div className="field"><label htmlFor="past-start">From</label><input id="past-start" type="time" value={pastStartTime} onChange={(event) => setPastStartTime(event.target.value)} /></div>
        <div className="field"><label htmlFor="past-end">To</label><input id="past-end" type="time" value={pastEndTime} onChange={(event) => setPastEndTime(event.target.value)} /></div>
        <label className="field past-notes"><span>Notes</span><textarea value={pastNotes} onChange={(event) => setPastNotes(event.target.value)} placeholder="Optional workout notes" /></label>
      </div>
      <div className="past-exercise-list">{pastExercises.map((item) => <div className={`past-exercise-row past-${item.category}-row`} key={item.id}>
        <label className="field"><span>Category</span><select value={item.category} onChange={(event) => { const category = event.target.value as PastWorkoutExerciseDraft['category']; updatePastExercise(item.id, { category, name: '', muscleGroup: '' }); setPastBodyPartFilters((current) => ({ ...current, [item.id]: 'All' })) }}><option value="weight">Strength</option><option value="core">Abs & Core</option><option value="cardio">Cardio</option></select></label>
        <label className="field"><span>Body part</span><select value={pastBodyPartFilters[item.id] ?? 'All'} onChange={(event) => setPastBodyPartFilters((current) => ({ ...current, [item.id]: event.target.value }))}><option>All</option>{getExerciseBodyPartTags(pastExerciseOptions, item.category).map((tag) => <option key={tag}>{tag}</option>)}</select></label>
        <label className="field"><span>Exercise</span><select value={item.name} onChange={(event) => { const selected = filterExercises(pastExerciseOptions, item.category, pastBodyPartFilters[item.id] ?? 'All').find((option) => option.name === event.target.value); if (selected) updatePastExercise(item.id, { name: selected.name, muscleGroup: selected.muscleGroup }) }}><option value="">Choose from library</option>{filterExercises(pastExerciseOptions, item.category, pastBodyPartFilters[item.id] ?? 'All').map((option) => <option key={`${option.section}:${option.name}`} value={option.name}>{option.name}</option>)}</select></label>
        {item.category === 'cardio' ? <>
          <div className="field"><label>Minutes</label><input type="number" min="1" step="1" value={item.durationMinutes} onChange={(event) => updatePastExercise(item.id, { durationMinutes: event.target.value })} /></div>
          <div className="field"><label>Speed km/h (optional)</label><input type="number" min="0" step="0.1" value={item.speedKph} onChange={(event) => updatePastExercise(item.id, { speedKph: event.target.value })} /></div>
          <div className="field"><label>Distance km (optional)</label><input type="number" min="0" step="0.1" value={item.distanceKm} onChange={(event) => updatePastExercise(item.id, { distanceKm: event.target.value })} /></div>
          <div className="field"><label>Incline % (optional)</label><input type="number" min="0" step="0.5" value={item.inclinePercent} onChange={(event) => updatePastExercise(item.id, { inclinePercent: event.target.value })} /></div>
        </> : <>
          {item.setValues ? <div className="history-edit-sets">{item.setValues.map((set, index) => <div className="history-edit-set" key={`${item.id}-${index}`}><strong>Set {index + 1}</strong><label className="field"><span>Reps</span><input type="number" min="0" value={set.reps} onChange={(event) => updatePastSet(item.id, index, { reps: event.target.value })} /></label>{item.category === 'weight' ? <label className="field"><span>Weight kg</span><input type="number" min="0" step="0.5" value={set.weightKg} onChange={(event) => updatePastSet(item.id, index, { weightKg: event.target.value })} /></label> : <label className="field"><span>Seconds</span><input type="number" min="0" value={set.durationSeconds} onChange={(event) => updatePastSet(item.id, index, { durationSeconds: event.target.value })} /></label>}<button className="danger-button" disabled={item.setValues?.length === 1} aria-label={`Remove set ${index + 1}`} onClick={() => removePastSet(item, index)}>Remove set</button></div>)}<button className="secondary-button" onClick={() => addPastSet(item)}><Plus size={14} />Add set</button></div> : <><div className="field"><label>Sets</label><input type="number" min="1" step="1" value={item.setCount} onChange={(event) => updatePastExercise(item.id, { setCount: event.target.value })} /></div><div className="field"><label>Reps{item.category === 'core' ? ' (optional)' : ''}</label><input type="number" min="0" step="1" value={item.reps} onChange={(event) => updatePastExercise(item.id, { reps: event.target.value })} /></div>{item.category === 'weight' ? <div className="field"><label>Weight kg</label><input type="number" min="0" step="0.5" value={item.weightKg} onChange={(event) => updatePastExercise(item.id, { weightKg: event.target.value })} /></div> : <div className="field"><label>Seconds per set (optional)</label><input type="number" min="0" step="1" value={item.durationSeconds} onChange={(event) => updatePastExercise(item.id, { durationSeconds: event.target.value })} /></div>}</>}
        </>}
        <button className="danger-button" aria-label={`Remove ${item.name || 'exercise row'}`} onClick={() => setPastExercises((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button>
      </div>)}</div>
      <div className="past-form-actions"><button className="secondary-button" onClick={() => setPastExercises((current) => [...current, { ...initialPastExercise, id: createId() }])}><Plus size={16} />Add exercise</button><button className="primary-button" onClick={() => void savePastWorkout()}>{editingDate ? 'Save changes' : 'Save workout'}</button></div>
    </section>}
    {conflicts.length > 0 && <section className="panel"><div className="panel-header"><h2>Workout sync conflicts</h2></div><p>Choose which version to keep for each workout.</p>{conflicts.map((item) => { const local = JSON.parse(item.payload) as Partial<Workout>; return <article className="exercise-card" key={item.id}><h3>{local.localDate ?? 'Workout'} · {(local.plannedFocus ?? []).join(' + ')}</h3><div style={{ display: 'flex', gap: 8 }}><button className="secondary-button" onClick={() => void resolveConflict(item, 'keep-local')}>Keep this device's version</button><button className="secondary-button" onClick={() => void resolveConflict(item, 'use-cloud')}>Use cloud version</button></div></article> })}{conflictMessage && <p role="status">{conflictMessage}</p>}</section>}
    <section className="panel">{workoutDays.length === 0 ? <div className="empty-state">Completed workouts will appear here.</div> : <div className="history-days">{workoutDays.map((day) => { const workoutIds = new Set(day.workouts.map((workout) => workout.id)); const dayExercises = historyExercises.filter((exercise) => workoutIds.has(exercise.workoutId)); const dayCardio = historyCardio.filter((entry) => workoutIds.has(entry.workoutId)); const daySets = historySets.filter((set) => workoutIds.has(set.workoutId)); const volume = daySets.filter((set) => set.completed && set.weightKg != null && set.reps != null).reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0); return <article className="history-day" key={day.localDate}><header className="history-day-header"><div><div className="eyebrow">{day.localDate}</div><h2>{day.focus.join(' + ')}</h2><p>{day.locations.join(', ') || 'Location not set'} · {formatElapsed(day.durationSeconds)}</p></div><div className="history-day-actions"><button className="secondary-button" onClick={() => editWorkoutDay(day)}>Edit session</button><button className="danger-button" onClick={() => void deleteWorkoutDay(day)}>Delete day</button></div></header><div className="history-day-stats"><span>{dayExercises.length} strength/core exercises</span><span>{dayCardio.length} cardio entries</span><span>{volume.toLocaleString()} kg volume</span></div><div className="history-exercise-list">{dayExercises.map((exercise) => <div className="history-exercise" key={exercise.id}><strong>{exercise.name}</strong><span className="badge">{exercise.muscleGroup}</span><div className="history-set-list">{historySets.filter((set) => set.workoutExerciseId === exercise.id).map((set) => <span key={set.id}>Set {set.setNumber}: {set.reps ?? '—'} reps · {exercise.section === 'core' ? `${set.durationSeconds ?? '—'} sec` : `${set.weightKg ?? '—'} kg`}</span>)}</div></div>)}{dayCardio.map((entry) => <div className="history-exercise" key={entry.id}><strong>{entry.activityType}</strong><span className="badge">Cardio</span><div className="history-set-list"><span>{Math.round(entry.durationSeconds / 60)} min{entry.speedKph != null ? ` · ${entry.speedKph} km/h` : ''}{entry.distanceMeters != null ? ` · ${(entry.distanceMeters / 1000).toFixed(1)} km` : ''}{entry.inclinePercent != null ? ` · ${entry.inclinePercent}% incline` : ''}</span></div></div>)}</div></article> })}</div>}</section>
  </div>
}

function LibraryPage() {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customMuscleGroup, setCustomMuscleGroup] = useState('Chest')
  const [custom, setCustom] = useState<Exercise[]>([])
  async function load() {
    const records = await db.exercises.toArray()
    startTransition(() => setCustom(records))
  }
  useEffect(() => { void load() }, [])
  async function addExercise() {
    if (!customName.trim()) return
    const now = currentTimestamp()
    const exerciseType: Exercise['exerciseType'] = customMuscleGroup === 'Cardio' ? 'cardio' : customMuscleGroup === 'Core' ? 'core' : 'strength'
    const item: Exercise = { id: createId(), name: customName.trim(), muscleGroups: [customMuscleGroup], equipment: '', exerciseType, instructions: '', isCustom: true, createdAt: now, updatedAt: now, deletedAt: null }
    await db.exercises.add(item)
    await enqueue('exercises', item.id, item, 1)
    setCustomName('')
    await load()
  }
  async function editExercise(option: ExerciseOption) {
    const name = window.prompt('Exercise name', option.name)
    if (name == null || !name.trim()) return
    const muscleGroup = window.prompt('Body part tag', option.muscleGroup)
    if (muscleGroup == null || !muscleGroup.trim()) return
    const existing = custom.find((item) => item.catalogKey === option.catalogKey && option.catalogKey)
      ?? custom.find((item) => item.id === option.exerciseId)
    const now = currentTimestamp()
    const group = muscleGroup.trim()
    const item: Exercise = {
      id: existing?.id ?? createId(), catalogKey: option.catalogKey, name: name.trim(), muscleGroups: group.split(',').map((tag) => tag.trim()).filter(Boolean),
      equipment: existing?.equipment ?? '', exerciseType: group.toLowerCase() === 'cardio' ? 'cardio' : group.toLowerCase() === 'core' ? 'core' : 'strength',
      instructions: existing?.instructions ?? '', isCustom: existing?.isCustom ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now, deletedAt: null,
    }
    await db.exercises.put(item)
    await enqueue('exercises', item.id, item, 1)
    await load()
  }
  async function deleteExercise(option: ExerciseOption) {
    if (!window.confirm(`Delete ${option.name} from the exercise library?`)) return
    const existing = custom.find((item) => Boolean(option.catalogKey) && item.catalogKey === option.catalogKey)
      ?? custom.find((item) => item.id === option.exerciseId)
    const now = currentTimestamp()
    const deleted: Exercise = existing
      ? { ...existing, deletedAt: now, updatedAt: now }
      : {
          id: createId(), catalogKey: option.catalogKey, name: option.name, muscleGroups: option.muscleGroup.split(',').map((tag) => tag.trim()),
          equipment: '', exerciseType: option.section === 'core' ? 'core' : option.section === 'cardio' ? 'cardio' : 'strength',
          instructions: '', isCustom: false, createdAt: now, updatedAt: now, deletedAt: now,
        }
    await db.exercises.put(deleted)
    await enqueue('exercises', deleted.id, deleted, 1)
    await load()
  }
  const items = getExerciseCatalog(custom).filter((item) => `${item.name} ${item.muscleGroup}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Movement database</div><h1>Exercise library</h1></div></div><section className="panel"><div className="exercise-row"><div className="field"><label htmlFor="exercise-search">Search exercises</label><input id="exercise-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or body part" /></div><div className="field"><label htmlFor="custom-exercise">Add library exercise</label><input id="custom-exercise" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Exercise or activity" /></div><div className="field"><label htmlFor="custom-muscle">Body part</label><select id="custom-muscle" value={customMuscleGroup} onChange={(event) => setCustomMuscleGroup(event.target.value)}>{['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio', 'Other'].map((group) => <option key={group}>{group}</option>)}</select></div><button className="primary-button" onClick={addExercise}><Plus size={16} />Add</button></div><div className="library-grid" style={{ marginTop: 16 }}>{items.map((item) => <article className="exercise-card" key={item.catalogKey ?? item.exerciseId ?? `${item.section}:${item.name}`}><div className="exercise-library-title"><h3>{item.name}</h3><div className="exercise-library-actions"><button className="secondary-button" onClick={() => void editExercise(item)}>Edit</button><button className="danger-button" onClick={() => void deleteExercise(item)}>Delete</button></div></div><p>{item.section === 'weight' ? 'Strength' : item.section === 'core' ? 'Abs & Core' : 'Cardio'}</p><span className="badge">{item.muscleGroup}</span></article>)}</div></section></div>
}

function PlanPage() {
  const [days, setDays] = useState(weeklySplit.map((item) => ({ id: item.day, day: item.day, focus: [...item.focus], updatedAt: '' })))
  const [message, setMessage] = useState('')

  useEffect(() => {
    void db.planDays.toArray().then((saved) => {
      const byDay = new Map(saved.map((item) => [item.day, item]))
      const merged = weeklySplit.map((item) => byDay.get(item.day) ?? { id: item.day, day: item.day, focus: [...item.focus], updatedAt: '' })
      startTransition(() => setDays(merged))
    })
  }, [])

  function updateFocus(day: string, value: string) {
    const focus = value.split(',').map((item) => item.trim()).filter(Boolean)
    setDays((current) => current.map((item) => item.day === day ? { ...item, focus } : item))
  }

  async function savePlan() {
    const now = currentTimestamp()
    const updated = days.map((item) => ({ ...item, updatedAt: now }))
    await db.planDays.bulkPut(updated)
    setDays(updated)
    setMessage('Weekly plan saved on this device.')
  }

  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Training structure</div><h1>Weekly plan</h1></div><button className="primary-button" onClick={() => void savePlan()}>Save plan</button></div>{message && <p className="status-message" role="status">{message}</p>}<section className="panel"><div className="plan-editor-grid">{days.map((item) => <article className="plan-day-row" key={item.day}><h2>{item.day}</h2><label className="field"><span>Training focus</span><input value={item.focus.join(', ')} onChange={(event) => updateFocus(item.day, event.target.value)} placeholder="Leave empty for a rest day" /></label><small>{item.focus.length ? 'Cardio and core can be logged separately.' : 'Recovery day'}</small></article>)}</div></section></div>
}

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
