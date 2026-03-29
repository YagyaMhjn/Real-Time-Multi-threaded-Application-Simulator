// ============================================================
// synchronization.js — Semaphore & Monitor Simulator
// ============================================================
import { Thread, STATES, STATE_COLORS } from './utils.js';

// ───────────────────────── SEMAPHORE ─────────────────────────
export class SemaphoreSimulator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.semaphoreValue = 1;
    this.maxValue = 1;
    this.threads = [];
    this.waitingQueue = [];
    this.insideCritical = [];       // size atmost = maxValue
    this.completedThreads = [];
    this.running = false;
    this.intervalId = null;
    this.logEntries = [];
    this.threadCounter = 0;
    this.speed = 1200;
    this._init();
  }

  _init() {
    this._render();
    this._bindEvents();
    this.reset();
  }

  _render() {
    this.container.innerHTML = `
      <!-- Controls -->
      <div class="controls-bar">
        <div class="control-group">
          <span class="control-label">Semaphore Value (max)</span>
          <input type="number" class="number-input" id="sem-value" value="1" min="1" max="5">
        </div>
        <div class="control-group">
          <button class="btn btn-primary btn-sm" id="sem-add-thread">＋ Add Thread</button>
        </div>
        <div class="control-group" style="margin-left:auto;">
          <button class="btn btn-success btn-sm" id="sem-play">▶ Run</button>
          <button class="btn btn-secondary btn-sm" id="sem-step">⏭ Step</button>
          <button class="btn btn-danger btn-sm" id="sem-reset">↺ Reset</button>
        </div>
      </div>

      <!-- Visualization -->
      <div class="glass-card">
        <div class="sync-container">
          <!-- Waiting Queue -->
          <div class="waiting-queue">
            <div class="layer-label">⏳ Waiting Queue</div>
            <div id="sem-waiting" class="threads-row" style="flex-direction:column; gap:8px;"></div>
          </div>

          <!-- Critical Section -->
          <div class="critical-section" id="sem-critical">
            <span class="critical-section-label">Critical Section</span>
            <div class="semaphore-counter">
              <div id="sem-counter-display">1</div>
              <div class="counter-label">Semaphore Count</div>
            </div>
            <div id="sem-inside" class="threads-row" style="justify-content:center; gap:12px;"></div>
          </div>

          <!-- Completed -->
          <div class="completed-area">
            <div class="layer-label">✅ Completed</div>
            <div id="sem-completed" class="threads-row" style="flex-direction:column; gap:8px;"></div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-ready)"></div> Ready (wants to enter)</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-waiting)"></div> Waiting (blocked by semaphore)</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-running)"></div> In Critical Section</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-terminated)"></div> Completed</div>
      </div>

      <!-- Event Log -->
      <div class="event-log" id="sem-log"></div>

      <!-- Info Panel -->
      <div class="info-panel">
        <button class="info-toggle" id="sem-info-toggle">
          <span>📖 Learn More — Semaphores</span>
          <span class="arrow">▼</span>
        </button>
        <div class="info-body" id="sem-info-body">
          <h4>What is a Semaphore?</h4>
          <ul>
            <li>A semaphore is a synchronization primitive that controls access to a shared resource using a <strong>counter</strong>.</li>
            <li><code>wait()</code> (or <code>P()</code>): Decrements the counter. If counter &lt; 0, the thread is blocked and added to the waiting queue.</li>
            <li><code>signal()</code> (or <code>V()</code>): Increments the counter. If any threads are waiting, one is woken up.</li>
          </ul>
          <h4>Binary Semaphore (Mutex)</h4>
          <ul>
            <li>Semaphore with max value = 1. Acts as a mutual exclusion lock.</li>
            <li>Only one thread can be in the critical section at a time.</li>
          </ul>
          <h4>Counting Semaphore</h4>
          <ul>
            <li>Semaphore with max value = N. Allows up to N threads in the critical section simultaneously.</li>
            <li>Useful for resource pools (e.g., connection pool of size N).</li>
          </ul>
          <h4>Producer-Consumer Pattern</h4>
          <ul>
            <li>This simulator demonstrates the core mechanism: threads <code>wait()</code> before entering and <code>signal()</code> after exiting the critical section.</li>
          </ul>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.container.querySelector('#sem-add-thread').addEventListener('click', () => this.addThread());
    this.container.querySelector('#sem-play').addEventListener('click', () => this.toggleRun());
    this.container.querySelector('#sem-step').addEventListener('click', () => this.step());
    this.container.querySelector('#sem-reset').addEventListener('click', () => this.reset());
    this.container.querySelector('#sem-value').addEventListener('change', () => this.reset());

    this.container.querySelector('#sem-info-toggle').addEventListener('click', () => {
      this.container.querySelector('#sem-info-toggle').classList.toggle('open');
      this.container.querySelector('#sem-info-body').classList.toggle('open');
    });
  }

  reset() {
    this.stop();
    this.maxValue = parseInt(this.container.querySelector('#sem-value').value) || 1;
    this.semaphoreValue = this.maxValue;
    this.threads = [];
    this.waitingQueue = [];
    this.insideCritical = [];
    this.completedThreads = [];
    this.logEntries = [];
    this.threadCounter = 0;

    // Create initial threads
    for (let i = 0; i < 5; i++) {
      this._createThread();
    }

    this._updateViz();
    this._log(`Reset. Semaphore initialized to ${this.maxValue}`, 'info');
  }

  _createThread() {
    this.threadCounter++;
    const t = new Thread(`T${this.threadCounter}`, 'user');
    t.state = STATES.READY;
    this.threads.push(t);
    this.waitingQueue.push(t);
    return t;
  }

  addThread() {
    if (this.threads.length >= 12) return;
    const t = this._createThread();
    this._updateViz();
    this._log(`Thread ${t.name} created → READY (waiting to enter)`, 'success');
  }

  toggleRun() {
    if (this.running) this.stop(); else this.start();
  }

  start() {
    this.running = true;
    const btn = this.container.querySelector('#sem-play');
    btn.textContent = '⏸ Pause';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    this.intervalId = setInterval(() => this.step(), this.speed);
  }

  stop() {
    this.running = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    const btn = this.container.querySelector('#sem-play');
    if (btn) {
      btn.textContent = '▶ Run';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-secondary');
    }
  }

  step() {
    // Try to release a thread from critical section
    if (this.insideCritical.length > 0 && Math.random() < 0.4) {
      const thread = this.insideCritical.shift();
      thread.state = STATES.TERMINATED;
      this.completedThreads.push(thread);
      this.semaphoreValue++;
      this._log(`${thread.name} exits critical section. signal() → semaphore = ${this.semaphoreValue}`, 'success');
    }

    // Try to admit a waiting thread
    if (this.waitingQueue.length > 0 && this.semaphoreValue > 0) {
      const thread = this.waitingQueue.shift();
      this.semaphoreValue--;
      thread.state = STATES.RUNNING;
      this.insideCritical.push(thread);
      this._log(`${thread.name} calls wait() → enters critical section. Semaphore = ${this.semaphoreValue}`, 'info');
    } else if (this.waitingQueue.length > 0 && this.semaphoreValue <= 0) {
      // Thread tries but can't enter
      const thread = this.waitingQueue[0];
      if (thread.state !== STATES.WAITING) {
        thread.state = STATES.WAITING;
        this._log(`${thread.name} calls wait() → BLOCKED (semaphore = ${this.semaphoreValue})`, 'error');
      }
    }

    // Check if done
    if (this.waitingQueue.length === 0 && this.insideCritical.length === 0) {
      this.stop();
      this._log('All threads have completed!', 'warning');
    }

    this._updateViz();
  }

  _log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.logEntries.push({ time, message, type });
    if (this.logEntries.length > 50) this.logEntries.shift();
    const logEl = this.container.querySelector('#sem-log');
    logEl.innerHTML = this.logEntries.map(e =>
      `<div class="log-entry log-${e.type}">
        <span class="log-time">[${e.time}]</span>
        <span class="log-thread">${e.message}</span>
      </div>`
    ).reverse().join('');
  }

  _updateViz() {
    // Counter
    const counter = this.container.querySelector('#sem-counter-display');
    counter.textContent = this.semaphoreValue;
    counter.style.color = this.semaphoreValue > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)';

    // Waiting queue
    const waitingEl = this.container.querySelector('#sem-waiting');
    waitingEl.innerHTML = this.waitingQueue.map(t => `
      <div class="thread-node anim-slide-left">
        <div class="thread-circle" data-state="${t.state}">${t.name}</div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:16px;font-size:0.8rem;">Empty</div>';

    // Inside critical section
    const insideEl = this.container.querySelector('#sem-inside');
    insideEl.innerHTML = this.insideCritical.map(t => `
      <div class="thread-node anim-scale-pop">
        <div class="thread-circle" data-state="Running">${t.name}</div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:16px;font-size:0.8rem;">No threads inside</div>';

    // Completed
    const completedEl = this.container.querySelector('#sem-completed');
    completedEl.innerHTML = this.completedThreads.map(t => `
      <div class="thread-node anim-slide-right">
        <div class="thread-circle" data-state="Terminated">${t.name}</div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:16px;font-size:0.8rem;">None yet</div>';
  }
}

// ───────────────────────── MONITOR ─────────────────────────
export class MonitorSimulator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.threads = [];
    this.entryQueue = [];      // threads waiting to acquire lock
    this.waitQueue = [];       // threads that called wait() inside monitor
    this.insideMonitor = null; // the thread currently holding the lock
    this.completedThreads = [];
    this.locked = false;
    this.running = false;
    this.intervalId = null;
    this.logEntries = [];
    this.threadCounter = 0;
    this.speed = 1200;
    this._init();
  }

  _init() {
    this._render();
    this._bindEvents();
    this.reset();
  }

  _render() {
    this.container.innerHTML = `
      <!-- Controls -->
      <div class="controls-bar">
        <div class="control-group">
          <button class="btn btn-primary btn-sm" id="mon-add-thread">＋ Add Thread</button>
        </div>
        <div class="control-group" style="margin-left:auto;">
          <button class="btn btn-success btn-sm" id="mon-play">▶ Run</button>
          <button class="btn btn-secondary btn-sm" id="mon-step">⏭ Step</button>
          <button class="btn btn-danger btn-sm" id="mon-reset">↺ Reset</button>
        </div>
      </div>

      <!-- Visualization -->
      <div class="glass-card">
        <div class="sync-container">
          <!-- Entry Queue -->
          <div class="waiting-queue">
            <div class="layer-label">🚪 Entry Queue</div>
            <div id="mon-entry" class="threads-row" style="flex-direction:column; gap:8px;"></div>
          </div>

          <!-- Monitor Box -->
          <div class="critical-section" id="mon-monitor-box">
            <span class="critical-section-label">Monitor</span>

            <!-- Lock indicator -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
              <div class="monitor-lock" id="mon-lock-icon">🔓</div>
              <span id="mon-lock-label" style="font-size:0.8rem;color:var(--text-secondary);">Unlocked</span>
            </div>

            <!-- Thread inside monitor -->
            <div id="mon-inside" style="min-height:60px;display:flex;align-items:center;justify-content:center;"></div>

            <!-- Condition Variable Wait Queue -->
            <div style="margin-top:16px;width:100%;">
              <div class="layer-label">💤 Condition Wait Queue</div>
              <div id="mon-wait-queue" class="threads-row" style="justify-content:center;gap:8px;min-height:50px;"></div>
            </div>
          </div>

          <!-- Completed -->
          <div class="completed-area">
            <div class="layer-label">✅ Completed</div>
            <div id="mon-completed" class="threads-row" style="flex-direction:column; gap:8px;"></div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-ready)"></div> Entry Queue (waiting for lock)</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-running)"></div> Inside Monitor (holds lock)</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-waiting)"></div> Condition Wait Queue</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-terminated)"></div> Completed</div>
      </div>

      <!-- Event Log -->
      <div class="event-log" id="mon-log"></div>

      <!-- Info Panel -->
      <div class="info-panel">
        <button class="info-toggle" id="mon-info-toggle">
          <span>📖 Learn More — Monitors</span>
          <span class="arrow">▼</span>
        </button>
        <div class="info-body" id="mon-info-body">
          <h4>What is a Monitor?</h4>
          <ul>
            <li>A monitor is a high-level synchronization construct that encapsulates shared data and the operations on it.</li>
            <li>It provides <strong>mutual exclusion</strong> automatically — only one thread can execute inside the monitor at any time.</li>
            <li>The monitor uses an implicit <strong>lock</strong> that is acquired on entry and released on exit.</li>
          </ul>
          <h4>Condition Variables</h4>
          <ul>
            <li><code>wait()</code>: The thread releases the monitor lock, is placed in a condition wait queue, and is suspended.</li>
            <li><code>signal()</code>: Wakes up one thread from the condition wait queue. The awakened thread must reacquire the lock.</li>
            <li><code>broadcast()</code>: Wakes up all threads waiting on the condition variable.</li>
          </ul>
          <h4>Monitor vs. Semaphore</h4>
          <ul>
            <li>Monitors are a higher-level abstraction — the lock is managed automatically.</li>
            <li>Semaphores require the programmer to manually call <code>wait()</code> and <code>signal()</code> in the correct order.</li>
            <li>Monitors reduce the chance of errors like forgetting to release a lock.</li>
          </ul>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.container.querySelector('#mon-add-thread').addEventListener('click', () => this.addThread());
    this.container.querySelector('#mon-play').addEventListener('click', () => this.toggleRun());
    this.container.querySelector('#mon-step').addEventListener('click', () => this.step());
    this.container.querySelector('#mon-reset').addEventListener('click', () => this.reset());

    this.container.querySelector('#mon-info-toggle').addEventListener('click', () => {
      this.container.querySelector('#mon-info-toggle').classList.toggle('open');
      this.container.querySelector('#mon-info-body').classList.toggle('open');
    });
  }

  reset() {
    this.stop();
    this.threads = [];
    this.entryQueue = [];
    this.waitQueue = [];
    this.insideMonitor = null;
    this.completedThreads = [];
    this.locked = false;
    this.logEntries = [];
    this.threadCounter = 0;

    for (let i = 0; i < 5; i++) {
      this._createThread();
    }

    this._updateViz();
    this._log('Monitor reset. Lock available.', 'info');
  }

  _createThread() {
    this.threadCounter++;
    const t = new Thread(`T${this.threadCounter}`, 'user');
    t.state = STATES.READY;
    this.threads.push(t);
    this.entryQueue.push(t);
    return t;
  }

  addThread() {
    if (this.threads.length >= 12) return;
    const t = this._createThread();
    this._updateViz();
    this._log(`Thread ${t.name} created → Entry Queue`, 'success');
  }

  toggleRun() {
    if (this.running) this.stop(); else this.start();
  }

  start() {
    this.running = true;
    const btn = this.container.querySelector('#mon-play');
    btn.textContent = '⏸ Pause';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    this.intervalId = setInterval(() => this.step(), this.speed);
  }

  stop() {
    this.running = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    const btn = this.container.querySelector('#mon-play');
    if (btn) {
      btn.textContent = '▶ Run';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-secondary');
    }
  }

  step() {
    // If a thread is inside the monitor
    if (this.insideMonitor) {
      const t = this.insideMonitor;

      // Track how many steps this thread has been inside the monitor
      if (t._monitorSteps === undefined) t._monitorSteps = 0;
      t._monitorSteps++;

      // Decide what the thread does this step
      const hasWaiters = this.waitQueue.length > 0;
      // Count threads that could potentially signal (entry queue + inside)
      const canBeSignaled = this.entryQueue.length > 0;

      if (hasWaiters) {
        // --- Priority: signal a waiting thread before doing anything else ---
        const woken = this.waitQueue.shift();
        woken.state = STATES.READY;
        this.entryQueue.push(woken); // goes back to entry queue (must reacquire lock)
        this._log(`${t.name} calls signal() → wakes ${woken.name} (moves to Entry Queue)`, 'info');

        // After signaling, the thread may continue or exit
        if (t._monitorSteps >= 3) {
          // Thread done, exits monitor
          t.state = STATES.TERMINATED;
          t._monitorSteps = undefined;
          this.completedThreads.push(t);
          this.insideMonitor = null;
          this.locked = false;
          this._log(`${t.name} exits monitor → COMPLETED. Lock released.`, 'success');
        } else {
          this._log(`${t.name} continues executing inside monitor...`, 'info');
        }
      } else if (t._monitorSteps >= 3 || (t._monitorSteps >= 2 && Math.random() < 0.5)) {
        // --- Thread has executed enough, finish and exit ---
        t.state = STATES.TERMINATED;
        t._monitorSteps = undefined;
        this.completedThreads.push(t);
        this.insideMonitor = null;
        this.locked = false;
        this._log(`${t.name} exits monitor → COMPLETED. Lock released.`, 'success');
      } else if (t._monitorSteps === 1 && canBeSignaled && Math.random() < 0.3) {
        // --- Thread calls wait() — only if other threads exist to eventually signal ---
        t.state = STATES.WAITING;
        t._monitorSteps = undefined;
        this.waitQueue.push(t);
        this.insideMonitor = null;
        this.locked = false;
        this._log(`${t.name} calls wait() → releases lock, moves to Wait Queue`, 'warning');
      } else {
        // --- Thread continues executing ---
        this._log(`${this.insideMonitor.name} executing inside monitor... (step ${t._monitorSteps})`, 'info');
      }
    }

    // If monitor is unlocked, let a thread from entry queue in
    if (!this.locked && this.entryQueue.length > 0) {
      const thread = this.entryQueue.shift();
      thread.state = STATES.RUNNING;
      this.insideMonitor = thread;
      this.locked = true;
      this._log(`${thread.name} acquires lock → enters monitor`, 'info');
    }

    // Check completion
    if (this.entryQueue.length === 0 && this.waitQueue.length === 0 && !this.insideMonitor) {
      this.stop();
      this._log('All threads completed!', 'warning');
    }

    this._updateViz();
  }

  _log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.logEntries.push({ time, message, type });
    if (this.logEntries.length > 50) this.logEntries.shift();
    const logEl = this.container.querySelector('#mon-log');
    logEl.innerHTML = this.logEntries.map(e =>
      `<div class="log-entry log-${e.type}">
        <span class="log-time">[${e.time}]</span>
        <span class="log-thread">${e.message}</span>
      </div>`
    ).reverse().join('');
  }

  _updateViz() {
    // Lock icon
    const lockIcon = this.container.querySelector('#mon-lock-icon');
    const lockLabel = this.container.querySelector('#mon-lock-label');
    if (this.locked) {
      lockIcon.textContent = '🔒';
      lockIcon.className = 'monitor-lock locked';
      lockLabel.textContent = 'Locked';
      lockLabel.style.color = 'var(--accent-rose)';
    } else {
      lockIcon.textContent = '🔓';
      lockIcon.className = 'monitor-lock unlocked';
      lockLabel.textContent = 'Unlocked';
      lockLabel.style.color = 'var(--accent-emerald)';
    }

    // Entry queue
    const entryEl = this.container.querySelector('#mon-entry');
    entryEl.innerHTML = this.entryQueue.map(t => `
      <div class="thread-node anim-slide-left">
        <div class="thread-circle" data-state="${t.state}">${t.name}</div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:16px;font-size:0.8rem;">Empty</div>';

    // Inside monitor
    const insideEl = this.container.querySelector('#mon-inside');
    if (this.insideMonitor) {
      insideEl.innerHTML = `
        <div class="thread-node anim-scale-pop">
          <div class="thread-circle" data-state="Running" style="width:56px;height:56px;font-size:0.9rem;">${this.insideMonitor.name}</div>
          <span class="thread-label">Executing</span>
        </div>`;
    } else {
      insideEl.innerHTML = '<div class="empty-state" style="padding:8px;font-size:0.8rem;">No thread</div>';
    }

    // Wait queue
    const waitEl = this.container.querySelector('#mon-wait-queue');
    waitEl.innerHTML = this.waitQueue.map(t => `
      <div class="thread-node anim-fade-in">
        <div class="thread-circle" data-state="Waiting">${t.name}</div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:8px;font-size:0.8rem;">Empty</div>';

    // Completed
    const completedEl = this.container.querySelector('#mon-completed');
    completedEl.innerHTML = this.completedThreads.map(t => `
      <div class="thread-node anim-slide-right">
        <div class="thread-circle" data-state="Terminated">${t.name}</div>
      </div>
    `).join('') || '<div class="empty-state" style="padding:16px;font-size:0.8rem;">None yet</div>';
  }
}
