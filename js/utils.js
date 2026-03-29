// ============================================================
// utils.js — Shared utilities for the Multithreading Simulator
// ============================================================

// Thread States
export const STATES = {
  NEW: 'New',
  READY: 'Ready',
  RUNNING: 'Running',
  WAITING: 'Waiting',
  TERMINATED: 'Terminated',
};

// State colors (matching CSS variables)
export const STATE_COLORS = {
  [STATES.NEW]: '#10b981',       // Emerald
  [STATES.READY]: '#06b6d4',     // Cyan
  [STATES.RUNNING]: '#f59e0b',   // Amber
  [STATES.WAITING]: '#f43f5e',   // Rose
  [STATES.TERMINATED]: '#6b7280', // Gray
};

// State glow colors
export const STATE_GLOWS = {
  [STATES.NEW]: 'rgba(16,185,129,0.5)',
  [STATES.READY]: 'rgba(6,182,212,0.5)',
  [STATES.RUNNING]: 'rgba(245,158,11,0.5)',
  [STATES.WAITING]: 'rgba(244,63,94,0.5)',
  [STATES.TERMINATED]: 'rgba(107,114,128,0.3)',
};

// Valid state transitions
const TRANSITIONS = {
  [STATES.NEW]: [STATES.READY],
  [STATES.READY]: [STATES.RUNNING],
  [STATES.RUNNING]: [STATES.READY, STATES.WAITING, STATES.TERMINATED],
  [STATES.WAITING]: [STATES.READY],
  [STATES.TERMINATED]: [],
};

let _threadIdCounter = 0;

export function resetThreadIdCounter() {
  _threadIdCounter = 0;
}

// Thread class
export class Thread {
  constructor(name, type = 'user') {
    this.id = ++_threadIdCounter;
    this.name = name || `T${this.id}`;
    this.state = STATES.NEW;
    this.type = type; // 'user' or 'kernel'
    this.mappedTo = null; // kernel thread id (for user threads)
    this.blockedAt = null;
    this.burstRemaining = Math.floor(Math.random() * 6) + 2; // 2-7 time units
    this.totalBurst = this.burstRemaining;
    this.waitTime = 0;
    this.turnaroundTime = 0;
  }

  canTransitionTo(newState) {
    return TRANSITIONS[this.state]?.includes(newState) ?? false;
  }

  transitionTo(newState) {
    if (this.canTransitionTo(newState)) {
      this.state = newState;
      if (newState === STATES.WAITING) {
        this.blockedAt = Date.now();
      }
      return true;
    }
    return false;
  }

  get color() {
    return STATE_COLORS[this.state];
  }

  get glow() {
    return STATE_GLOWS[this.state];
  }
}

// Kernel Thread class
export class KernelThread {
  constructor(id) {
    this.id = id;
    this.name = `K${id}`;
    this.assignedUserThreads = [];
    this.busy = false;
    this.currentThread = null;
  }
}

// Generate unique IDs
let _uniqueId = 0;
export function uniqueId(prefix = 'id') {
  return `${prefix}_${++_uniqueId}`;
}

// Sleep helper for async simulations
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clamp a number between min and max
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Shuffle array (Fisher-Yates)
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Simple event emitter
export class EventEmitter {
  constructor() {
    this._listeners = {};
  }
  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
    return this;
  }
  off(event, fn) {
    this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn);
    return this;
  }
  emit(event, ...args) {
    (this._listeners[event] || []).forEach(fn => fn(...args));
  }
}
