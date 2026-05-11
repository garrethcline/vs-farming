// Reactive climate access. Components re-render when climate changes
// (e.g. user uploads a custom CSV or the bundled climate.csv loads).
//
// Locations: the user can save multiple named climates ("Home", "Tropical
// outpost", "Mountain camp") and switch between them without re-uploading.
// Each location is { id, name, climate, hemisphere?, notes?, createdAt }.

import { useEffect, useState, useCallback } from 'react';
import {
  DEFAULT_CLIMATE,
  getCurrentClimate,
  setCurrentClimate,
  subscribeClimate,
  parseClimateCSV,
  serializeClimateCSV,
} from '../data/climate.js';

const STORAGE_KEY = 'vs-farming-climate-custom';   // legacy single-climate slot
const SOURCE_KEY = 'vs-farming-climate-source';    // 'inline' | 'bundled' | 'custom'
const LOCATIONS_KEY = 'vs-farming-climate-locations';  // array of saved locations
const ACTIVE_LOC_KEY = 'vs-farming-climate-active-id';

function readSource() {
  try { return localStorage.getItem(SOURCE_KEY) || 'inline'; } catch { return 'inline'; }
}

function writeSource(s) {
  try { localStorage.setItem(SOURCE_KEY, s); } catch {}
}

function readLocations() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocations(arr) {
  try { localStorage.setItem(LOCATIONS_KEY, JSON.stringify(arr)); } catch {}
}

function readActiveLocId() {
  try { return localStorage.getItem(ACTIVE_LOC_KEY); } catch { return null; }
}

function writeActiveLocId(id) {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_LOC_KEY);
    else localStorage.setItem(ACTIVE_LOC_KEY, id);
  } catch {}
}

// Raw CSV text cache. Lets us re-parse the same source if dpm changes
// (so day numbers map correctly to the user's actual server cycle).
let _rawCsvCache = null;
let _rawCsvSource = null;  // 'bundled' | 'custom' | null

export function reparseClimateForDpm(daysPerMonth) {
  if (!_rawCsvCache) return false;
  try {
    const parsed = parseClimateCSV(_rawCsvCache, daysPerMonth);
    if (parsed.length > 0) {
      setCurrentClimate(parsed);
      return true;
    }
  } catch (e) { /* swallow */ }
  return false;
}

// Bootstrap: try to restore custom climate from localStorage, then try to fetch
// ./climate.csv as the deployment default. Called once on app startup.
let _bootstrapped = false;
export async function bootstrapClimate() {
  if (_bootstrapped) return;
  _bootstrapped = true;

  // 1a. If the user has saved locations and an active id, use that.
  const locations = readLocations();
  const activeId = readActiveLocId();
  if (activeId) {
    const loc = locations.find(l => l.id === activeId);
    if (loc && Array.isArray(loc.climate) && loc.climate.length > 0) {
      writeSource('location');
      setCurrentClimate(loc.climate);
      return;
    }
  }

  // 1b. Legacy single-slot custom upload (migrate to locations on first save)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        writeSource('custom');
        setCurrentClimate(parsed);
        return;
      }
    }
  } catch (e) { /* fall through */ }

  // 2. Try to fetch the bundled climate.csv
  try {
    const res = await fetch('./climate.csv', { cache: 'no-cache' });
    if (res.ok) {
      const text = await res.text();
      const parsed = parseClimateCSV(text);
      if (parsed.length > 0) {
        _rawCsvCache = text;
        _rawCsvSource = 'bundled';
        writeSource('bundled');
        setCurrentClimate(parsed);
        return;
      }
    }
  } catch (e) { /* fall through */ }

  // 3. Inline default
  writeSource('inline');
}

function genId() {
  return 'loc_' + Math.random().toString(36).slice(2, 9);
}

export function useClimate() {
  const [climate, setClimateState] = useState(getCurrentClimate);
  const [source, setSourceState] = useState(readSource);
  const [locations, setLocationsState] = useState(readLocations);
  const [activeLocationId, setActiveLocationIdState] = useState(readActiveLocId);

  useEffect(() => {
    return subscribeClimate((arr) => {
      setClimateState(arr);
      setSourceState(readSource());
    });
  }, []);

  // Set the active climate from raw data (legacy single-slot path)
  const setCustom = useCallback((arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch {}
    writeSource('custom');
    writeActiveLocId(null);
    setActiveLocationIdState(null);
    setCurrentClimate(arr);
    setSourceState('custom');
  }, []);

  // Save a new named location. Optionally make it active.
  const addLocation = useCallback((name, climateArr, opts = {}) => {
    if (!name || !Array.isArray(climateArr) || climateArr.length === 0) return null;
    const loc = {
      id: genId(),
      name: name.trim().slice(0, 60) || 'Unnamed',
      climate: climateArr,
      hemisphere: opts.hemisphere || null,
      notes: opts.notes || '',
      createdAt: Date.now(),
    };
    const next = [...readLocations(), loc];
    writeLocations(next);
    setLocationsState(next);
    if (opts.activate !== false) {
      writeActiveLocId(loc.id);
      setActiveLocationIdState(loc.id);
      writeSource('location');
      setSourceState('location');
      setCurrentClimate(climateArr);
    }
    return loc.id;
  }, []);

  const removeLocation = useCallback((id) => {
    const next = readLocations().filter(l => l.id !== id);
    writeLocations(next);
    setLocationsState(next);
    if (readActiveLocId() === id) {
      // Switch to the first remaining location, or fall back to bundled
      if (next.length > 0) {
        writeActiveLocId(next[0].id);
        setActiveLocationIdState(next[0].id);
        setCurrentClimate(next[0].climate);
        writeSource('location');
        setSourceState('location');
      } else {
        writeActiveLocId(null);
        setActiveLocationIdState(null);
        // re-bootstrap to bundled or inline
        fetch('./climate.csv', { cache: 'no-cache' })
          .then(r => r.ok ? r.text() : null)
          .then(t => {
            if (t) {
              const parsed = parseClimateCSV(t);
              if (parsed.length > 0) {
                _rawCsvCache = t;
                _rawCsvSource = 'bundled';
                setCurrentClimate(parsed);
                writeSource('bundled');
                setSourceState('bundled');
                return;
              }
            }
            setCurrentClimate(DEFAULT_CLIMATE);
            writeSource('inline');
            setSourceState('inline');
          })
          .catch(() => {
            setCurrentClimate(DEFAULT_CLIMATE);
            writeSource('inline');
            setSourceState('inline');
          });
      }
    }
  }, []);

  const switchLocation = useCallback((id) => {
    const loc = readLocations().find(l => l.id === id);
    if (!loc) return;
    writeActiveLocId(id);
    setActiveLocationIdState(id);
    writeSource('location');
    setSourceState('location');
    setCurrentClimate(loc.climate);
  }, []);

  const renameLocation = useCallback((id, name) => {
    const next = readLocations().map(l =>
      l.id === id ? { ...l, name: (name || '').trim().slice(0, 60) || l.name } : l
    );
    writeLocations(next);
    setLocationsState(next);
  }, []);

  const reset = useCallback(async () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    writeSource('inline');
    setSourceState('inline');
    setCurrentClimate(DEFAULT_CLIMATE);
    try {
      const res = await fetch('./climate.csv', { cache: 'no-cache' });
      if (res.ok) {
        const text = await res.text();
        const parsed = parseClimateCSV(text);
        if (parsed.length > 0) {
          _rawCsvCache = text;
          _rawCsvSource = 'bundled';
          setCurrentClimate(parsed);
          writeSource('bundled');
          setSourceState('bundled');
        }
      }
    } catch {}
  }, []);

  return {
    climate, source, setCustom, reset,
    locations, activeLocationId,
    addLocation, removeLocation, switchLocation, renameLocation,
  };
}

// Helper: parse a File from an <input type="file"> and apply.
export function loadClimateFromFile(file, daysPerMonth) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file provided')); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseClimateCSV(e.target.result, daysPerMonth);
        if (parsed.length === 0) throw new Error('CSV had no valid rows');
        resolve(parsed);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Trigger a download of the current climate as a CSV file.
export function downloadClimateCSV(climate, filename = 'climate.csv') {
  const csv = serializeClimateCSV(climate);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
