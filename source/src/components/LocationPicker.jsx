// Quick climate-location switcher. Drop into any tab that uses climate data.
// Lets the user switch between saved locations or save the current climate as
// a new named location. Doesn't open the full Settings tab.

import { useState, useRef } from 'react';
import { useClimate, loadClimateFromFile } from '../lib/useClimate.js';
import { useSettings } from '../lib/storage.js';

export default function LocationPicker({ compact = false }) {
  const {
    locations, activeLocationId, source,
    addLocation, switchLocation, removeLocation, renameLocation,
    climate, setCustom,
  } = useClimate();
  const [settings] = useSettings();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // What's the current label?
  const activeLoc = locations.find(l => l.id === activeLocationId);
  const currentLabel = activeLoc ? activeLoc.name
    : source === 'bundled' ? 'Bundled climate'
    : source === 'custom' ? 'Uploaded climate'
    : 'Default climate';

  const handleSaveCurrent = () => {
    if (!newName.trim()) { setError('Give it a name'); return; }
    if (!Array.isArray(climate) || climate.length === 0) { setError('No climate loaded'); return; }
    setError(null);
    addLocation(newName.trim(), climate);
    setNewName('');
    setOpen(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const parsed = await loadClimateFromFile(file, settings.daysPerMonth);
      const baseName = file.name.replace(/\.csv$/i, '').slice(0, 60) || 'New location';
      addLocation(baseName, parsed);
      setOpen(false);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-parchment-200/40 hover:bg-parchment-200/70 border border-parchment-300/60 text-sm transition-colors"
        title="Switch climate location"
      >
        <span className="text-ink-500 text-xs uppercase tracking-wider">Location</span>
        <span className="font-medium text-forest-900">{currentLabel}</span>
        <span className="text-ink-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-80 bg-parchment-100 border border-parchment-300/70 rounded-lg shadow-paper-strong p-3">
            {locations.length > 0 && (
              <div className="mb-3">
                <div className="section-eyebrow text-[10px] mb-2 text-ink-500">Saved locations</div>
                <div className="space-y-1">
                  {locations.map(loc => (
                    <LocationRow
                      key={loc.id}
                      loc={loc}
                      active={loc.id === activeLocationId}
                      onSelect={() => { switchLocation(loc.id); setOpen(false); }}
                      onRename={(name) => renameLocation(loc.id, name)}
                      onRemove={() => {
                        if (confirm(`Remove "${loc.name}"? Climate data will be lost.`)) {
                          removeLocation(loc.id);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-parchment-300/50 pt-3">
              <div className="section-eyebrow text-[10px] mb-2 text-ink-500">Save current as new</div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="input-field flex-1 text-sm"
                  placeholder="e.g. Mountain camp"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveCurrent()}
                  maxLength={60}
                />
                <button
                  onClick={handleSaveCurrent}
                  className="px-3 py-1.5 rounded-md bg-forest-700 text-parchment-50 text-sm font-medium hover:bg-forest-800 transition-colors"
                >
                  Save
                </button>
              </div>
              <div className="text-[11px] text-ink-500 italic mb-2">
                Saves whatever climate is currently active. Useful if you uploaded a CSV and want to keep it for later.
              </div>
            </div>

            <div className="border-t border-parchment-300/50 pt-3 mt-3">
              <div className="section-eyebrow text-[10px] mb-2 text-ink-500">Upload a different CSV</div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleUpload}
                disabled={busy}
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-parchment-300/40 file:text-forest-800 hover:file:bg-parchment-300/70 file:cursor-pointer"
              />
              <div className="text-[11px] text-ink-500 italic mt-1">
                Upload from <code className="text-[10px]">/debug exptempplot</code> or your own daily CSV. Auto-saved as a new location.
              </div>
            </div>

            {error && (
              <div className="mt-2 text-xs text-terra-700 bg-terra-300/20 border border-terra-400/30 rounded p-2">
                {error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LocationRow({ loc, active, onSelect, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(loc.name);

  if (editing) {
    return (
      <div className="flex gap-1 items-center">
        <input
          type="text"
          className="input-field flex-1 text-sm"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { onRename(name); setEditing(false); }
            if (e.key === 'Escape') { setName(loc.name); setEditing(false); }
          }}
          autoFocus
          maxLength={60}
        />
        <button
          onClick={() => { onRename(name); setEditing(false); }}
          className="px-2 py-1 text-xs text-forest-700 hover:text-forest-900"
          title="Save"
        >
          ✓
        </button>
        <button
          onClick={() => { setName(loc.name); setEditing(false); }}
          className="px-2 py-1 text-xs text-ink-500 hover:text-ink-700"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  // Quick climate summary: avg temp + length
  const avgTemp = loc.climate?.length
    ? (loc.climate.reduce((s, c) => s + (c.avg ?? 0), 0) / loc.climate.length).toFixed(1)
    : '?';

  return (
    <div className={`flex items-center gap-1 rounded p-2 ${active ? 'bg-forest-100/60 border border-forest-300/40' : 'hover:bg-parchment-200/50'}`}>
      <button
        onClick={onSelect}
        className="flex-1 text-left text-sm"
        disabled={active}
      >
        <div className={active ? 'font-semibold text-forest-900' : 'text-ink-800'}>
          {loc.name}
          {active && <span className="ml-2 text-[10px] uppercase tracking-wider text-forest-700">active</span>}
        </div>
        <div className="text-[11px] text-ink-500">
          avg {avgTemp}°C · {loc.climate?.length || 0} days
        </div>
      </button>
      <button
        onClick={() => setEditing(true)}
        className="px-1.5 py-1 text-[11px] text-ink-500 hover:text-forest-700"
        title="Rename"
      >
        ✎
      </button>
      <button
        onClick={onRemove}
        className="px-1.5 py-1 text-[11px] text-ink-400 hover:text-terra-700"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}
