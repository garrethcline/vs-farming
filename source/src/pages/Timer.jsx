// Game-to-real time calculator and countdowns.
//
// Vintage Story's calendar maps a game month to a configurable number of
// real-world hours. The ratio comes from two settings the player sees in
// the world config panel:
//   daysPerMonth      = game days per month (20 on this server)
//   realHoursPerMonth = wall-clock hours per game month (16 on this server)
//
// So 1 game day = realHoursPerMonth / daysPerMonth real hours.
// For 16/20: 0.8 hr = 48 min real per game day. 1 game hr = 2 real min.
//
// This page:
//   1. Shows the conversion ratio.
//   2. Calculator: enter "X game hours" or "X game days", get back wall-clock
//      duration AND the wall-clock time when it'll complete.
//   3. Active countdowns: name a timer, persist it, see live remaining time
//      while the page is open. Optionally download an .ics file so you can
//      put it in your phone calendar.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';
import { dateLabel, dayFromDate, dateParts } from '../data/climate.js';

const STORAGE_KEY = 'vs-farming-timers';

function loadTimers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveTimers(timers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch {}
}

// Convert a real-time duration in milliseconds to "Xh Ym" or "Xd Yh" or
// "Xm Ys" depending on size. Returns "ready" when <= 0.
function formatDuration(ms) {
  if (ms <= 0) return 'ready';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Format an absolute Date for human display, e.g. "Wed, May 6 · 8:30 PM".
function formatWallClock(date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format a duration in game hours as a human-readable string. Picks the
// units that fit best: minutes for sub-hour, hours+minutes for sub-day,
// days+hours for longer.
function formatGameDuration(gameHours) {
  if (gameHours == null || !isFinite(gameHours)) return '...';
  const totalMins = Math.round(gameHours * 60);
  if (totalMins < 60) return `${totalMins} min`;
  if (gameHours < 24) {
    const h = Math.floor(gameHours);
    const m = Math.round((gameHours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h} hr`;
  }
  const days = Math.floor(gameHours / 24);
  const remHours = Math.round(gameHours - days * 24);
  if (remHours === 0) return `${days}d`;
  return `${days}d ${remHours}h`;
}

// Build an iCalendar (.ics) blob for one event.
function buildIcs({ title, start, end, description = '' }) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VS Farming Dashboard//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@vs-farming`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title.replace(/[\n,;]/g, ' ')}`,
    `DESCRIPTION:${description.replace(/[\n,;]/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}

function downloadIcs(timer) {
  const start = new Date(timer.targetMs);
  const end = new Date(timer.targetMs + 30 * 60 * 1000);  // 30 min reminder window
  const blob = buildIcs({
    title: `Vintage Story · ${timer.name}`,
    start,
    end,
    description: `${timer.gameHours} game hours from ${new Date(timer.createdMs).toLocaleString()}`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${timer.name.replace(/[^a-z0-9]+/gi, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TimerPage() {
  const [settings, updateSettings] = useSettings();
  const dpm = settings.daysPerMonth || 20;
  const rhpm = settings.realHoursPerMonth || 16;

  // Real minutes per game hour, derived once.
  const realMinPerGameHour = useMemo(() => (rhpm * 60) / (dpm * 24), [dpm, rhpm]);
  const realMinPerGameDay = realMinPerGameHour * 24;

  const [timers, setTimers] = useState(loadTimers);
  const [, forceTick] = useState(0);

  // Tick every second so countdowns refresh.
  useEffect(() => {
    const id = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Persist timers on change.
  useEffect(() => { saveTimers(timers); }, [timers]);

  const addTimer = (timer) => setTimers(t => [...t, timer]);
  const removeTimer = (id) => setTimers(t => t.filter(x => x.id !== id));

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§T · Timer</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Game time, <span className="heading-italic">real time</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-3xl">
            Convert in-game hours to wall-clock time. Useful when the game says "147 hours till harvest" and you want to know whether to set a phone alarm or just wait. Set a countdown that ticks while this tab is open, or download a calendar reminder.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader eyebrow="Conversion" title="Your server's time scale" subtitle="Pulled from your world settings. Edit if your server differs." />
          <CardBody>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Days per month</label>
                <input
                  type="number" min="1" max="60"
                  className="input-field tabular w-24"
                  value={dpm}
                  onChange={(e) => updateSettings({ daysPerMonth: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
                <div className="text-[10px] text-ink-500 italic mt-1">From the world settings panel</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Real hours per month</label>
                <input
                  type="number" min="0.1" step="0.1"
                  className="input-field tabular w-24"
                  value={rhpm}
                  onChange={(e) => updateSettings({ realHoursPerMonth: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                />
                <div className="text-[10px] text-ink-500 italic mt-1">In-game shows this in parentheses next to "Days per month"</div>
              </div>
              <div className="flex-1 min-w-[200px] bg-parchment-100 border border-parchment-300/60 rounded p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-ink-600">Conversion</div>
                <div className="text-base text-forest-900 mt-1">
                  1 game hour = <span className="tabular font-medium">{realMinPerGameHour.toFixed(2)}</span> real minutes
                </div>
                <div className="text-base text-forest-900">
                  1 game day = <span className="tabular font-medium">{realMinPerGameDay.toFixed(0)}</span> real minutes ({(realMinPerGameDay / 60).toFixed(2)} hours)
                </div>
                <div className="text-xs text-ink-600 italic mt-1">
                  1 game month = {rhpm} real hours · 1 game year = {(rhpm * 12).toFixed(1)} real hours
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader eyebrow="Calculator" title="Convert + start a countdown" />
          <CardBody>
            <Calculator
              realMinPerGameHour={realMinPerGameHour}
              onStart={addTimer}
            />
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.12}>
        <Card>
          <CardHeader
            eyebrow="Date difference"
            title="Between two game dates"
            subtitle="Pick a start date and an end date. Returns the gap in game days plus the real-world wall-clock equivalent at your server's ratio."
          />
          <CardBody>
            <DateDifferenceCard dpm={dpm} realMinPerGameDay={realMinPerGameDay} today={settings.today} />
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Active"
            title={timers.length > 0 ? `${timers.length} countdown${timers.length === 1 ? '' : 's'}` : 'No active countdowns'}
            subtitle={timers.length > 0 ? 'Live while this tab is open. Persists across reloads. Download .ics to put on your phone.' : null}
          />
          {timers.length > 0 && (
            <CardBody>
              <div className="space-y-2">
                {timers.map(t => (
                  <TimerRow key={t.id} timer={t} onRemove={() => removeTimer(t.id)} />
                ))}
              </div>
            </CardBody>
          )}
        </Card>
      </Reveal>

      <Flourish />
    </div>
  );
}

function Calculator({ realMinPerGameHour, onStart }) {
  const [amount, setAmount] = useState('147');
  const [unit, setUnit] = useState('hours');
  const [name, setName] = useState('Harvest reminder');

  const gameHours = useMemo(() => {
    const n = parseFloat(amount);
    if (!isFinite(n)) return null;
    if (unit === 'minutes') return n / 60;
    if (unit === 'days') return n * 24;
    if (unit === 'months') return n * 24 * 20;  // approx; only used for display
    return n;
  }, [amount, unit]);

  const realMinutes = gameHours !== null ? gameHours * realMinPerGameHour : null;
  const targetDate = realMinutes !== null ? new Date(Date.now() + realMinutes * 60 * 1000) : null;

  const handleStart = () => {
    if (gameHours === null || gameHours <= 0) return;
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdMs = Date.now();
    const targetMs = createdMs + gameHours * realMinPerGameHour * 60 * 1000;
    onStart({
      id,
      name: name.trim() || 'Reminder',
      gameHours,
      createdMs,
      targetMs,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">In-game time remaining</label>
          <div className="flex gap-2">
            <input
              type="number" min="0" step="any"
              className="input-field tabular w-32"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
              className="select-field"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="minutes">game minutes</option>
              <option value="hours">game hours</option>
              <option value="days">game days</option>
              <option value="months">game months</option>
            </select>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-ink-700 mb-1">Label</label>
          <input
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What's the timer for?"
          />
        </div>
      </div>

      {realMinutes !== null && (
        <div className="bg-parchment-100 border border-parchment-300/60 rounded p-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-600">Real time</div>
              <div className="text-lg text-forest-900 font-medium tabular">{formatDuration(realMinutes * 60 * 1000)}</div>
              <div className="text-xs text-ink-500 italic">{realMinutes.toFixed(0)} minutes total</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-600">Will be ready</div>
              <div className="text-lg text-forest-900 font-medium">{formatWallClock(targetDate)}</div>
              <div className="text-xs text-ink-500 italic">{targetDate.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-600">In game terms</div>
              <div className="text-lg text-forest-900 font-medium tabular">
                {formatGameDuration(gameHours)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleStart}
          disabled={gameHours === null || gameHours <= 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start countdown
        </button>
        <button
          onClick={() => {
            if (gameHours === null || gameHours <= 0) return;
            const t = {
              id: `t-${Date.now()}`,
              name: name.trim() || 'Reminder',
              gameHours,
              createdMs: Date.now(),
              targetMs: Date.now() + gameHours * realMinPerGameHour * 60 * 1000,
            };
            downloadIcs(t);
          }}
          disabled={gameHours === null || gameHours <= 0}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Download calendar reminder (.ics)
        </button>
      </div>

      <div className="text-xs text-ink-500 italic">
        Browser countdowns only tick while the tab is open. For reliable phone alarms, use the .ics download to import into your calendar app, or just note the wall-clock time and set an alarm yourself.
      </div>
    </div>
  );
}

function TimerRow({ timer, onRemove }) {
  const remainingMs = timer.targetMs - Date.now();
  const ready = remainingMs <= 0;
  const totalDurationMs = timer.targetMs - timer.createdMs;
  const elapsedMs = totalDurationMs - remainingMs;
  const progress = Math.max(0, Math.min(1, elapsedMs / totalDurationMs));

  return (
    <div className={`border rounded p-3 transition-colors ${ready ? 'border-forest-700 bg-forest-100/40' : 'border-parchment-300/60'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="font-display text-base text-forest-900">
            {timer.name}
            {ready && <span className="ml-2 text-sm font-medium text-forest-700">✓ ready</span>}
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            {formatGameDuration(timer.gameHours)} game · ready at {formatWallClock(new Date(timer.targetMs))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl tabular font-medium text-forest-900">{formatDuration(remainingMs)}</div>
          <div className="text-[10px] text-ink-500 italic uppercase tracking-wider">{ready ? 'now' : 'remaining'}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadIcs(timer)}
            className="text-xs text-forest-700 hover:text-forest-900 underline"
            title="Download .ics for your calendar app"
          >
            .ics
          </button>
          <button
            onClick={onRemove}
            className="text-xs text-terra-700 hover:text-terra-900 underline"
            title="Remove this timer"
          >
            remove
          </button>
        </div>
      </div>
      <div className="mt-2 h-1 bg-parchment-200/60 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${ready ? 'bg-forest-500' : 'bg-forest-400/70'}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

// Date-difference calculator. Two game dates in, returns the game-day gap
// and the equivalent real-world wall-clock duration. Useful for planning:
// "If I plant on day 84 and harvest on day 109, that's 25 game days, which
// is 20 real hours of someone being on the server."
function DateDifferenceCard({ dpm, realMinPerGameDay, today }) {
  const todayParts = useMemo(() => dateParts(today, dpm), [today, dpm]);
  const defaultB = useMemo(() => dateParts(today + 30, dpm), [today, dpm]);

  // dateParts returns { year, dayInYear, monthIdx, dayOfMonth, monthName }.
  // dayFromDate expects (monthOneBased, dayOfMonth, year, dpm) so we map
  // monthIdx (0-based) → month (1-based) for the input value, and convert
  // back when computing the day.
  const [a, setA] = useState({
    year: todayParts.year,
    month: todayParts.monthIdx + 1,
    day: todayParts.dayOfMonth,
  });
  const [b, setB] = useState({
    year: defaultB.year,
    month: defaultB.monthIdx + 1,
    day: defaultB.dayOfMonth,
  });

  const dayA = dayFromDate(a.month, a.day, a.year, dpm);
  const dayB = dayFromDate(b.month, b.day, b.year, dpm);
  const gapDays = dayB - dayA;
  const gapAbs = Math.abs(gapDays);
  const realMinutes = gapAbs * realMinPerGameDay;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateInputBlock label="Start" parts={a} onChange={setA} dpm={dpm} />
        <DateInputBlock label="End" parts={b} onChange={setB} dpm={dpm} />
      </div>

      <div className="border-t border-parchment-300/40 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat label="Game days" value={`${gapDays >= 0 ? '+' : ''}${gapDays}`} sub={`${gapAbs} day${gapAbs === 1 ? '' : 's'} ${gapDays < 0 ? 'before' : 'after'}`} />
          <Stat label="Game hours" value={`${gapAbs * 24}`} sub="" />
          <Stat label="Real-world" value={formatRealMinutes(realMinutes)} sub={`assuming a player is online`} />
        </div>
        {gapDays !== 0 && (
          <div className="mt-3 text-xs text-ink-600 italic">
            {dateLabel(dayA, dpm)} (Year {a.year}) → {dateLabel(dayB, dpm)} (Year {b.year}). Game time only counts when at least one player is on the server, so real-world wall time stretches if the server is empty.
          </div>
        )}
      </div>
    </div>
  );
}

function DateInputBlock({ label, parts, onChange, dpm }) {
  return (
    <div className="border border-parchment-300/60 rounded p-3 bg-parchment-100/40">
      <div className="section-eyebrow text-forest-700 mb-2">{label}</div>
      <div className="flex items-end gap-2 flex-wrap">
        <NumField label="Day" value={parts.day} min={1} max={dpm} onChange={v => onChange({ ...parts, day: clampInt(v, 1, dpm) })} />
        <NumField label="Month" value={parts.month} min={1} max={12} onChange={v => onChange({ ...parts, month: clampInt(v, 1, 12) })} />
        <NumField label="Year" value={parts.year} min={0} max={9999} onChange={v => onChange({ ...parts, year: clampInt(v, 0, 9999) })} />
      </div>
      <div className="text-xs text-ink-600 italic mt-2">
        {MONTH_NAMES[parts.month - 1]} {parts.day}, Year {parts.year} (day {dayFromDate(parts.month, parts.day, parts.year, dpm)})
      </div>
    </div>
  );
}

function NumField({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <div className="text-xs text-ink-600 mb-0.5">{label}</div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="input-field tabular w-20"
      />
    </label>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3">
      <div className="text-xs text-ink-600 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-medium text-forest-900 tabular">{value}</div>
      {sub && <div className="text-xs text-ink-500 italic mt-0.5">{sub}</div>}
    </div>
  );
}

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function formatRealMinutes(min) {
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) {
    const hi = Math.floor(h);
    const m = Math.round(min - hi * 60);
    return m > 0 ? `${hi}h ${m}m` : `${hi}h`;
  }
  const days = h / 24;
  if (days < 10) {
    const d = Math.floor(days);
    const hi = Math.round(h - d * 24);
    return hi > 0 ? `${d}d ${hi}h` : `${d}d`;
  }
  return `${Math.round(days)} days`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
