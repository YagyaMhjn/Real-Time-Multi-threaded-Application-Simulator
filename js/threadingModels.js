// ============================================================
// threadingModels.js — Many-to-One, One-to-One, Many-to-Many
// ============================================================
import { Thread, STATES, STATE_COLORS, STATE_GLOWS, resetThreadIdCounter } from './utils.js';

export class ThreadingModelSimulator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.model = 'many-to-one'; // default
    this.userThreads = [];
    this.kernelThreads = [];
    this.running = false;
    this.intervalId = null;
    this.logEntries = [];
    this.speed = 1000;
    this._init();
  }

  _init() {
    this._render();
    this._bindEvents();
    this.reset();
  }

  _render() {
    this.container.innerHTML = `
      <!-- Model sub tabs -->
      <div class="model-tabs" id="model-sub-tabs">
        <button class="model-tab active" data-model="many-to-one">Many-to-One</button>
        <button class="model-tab" data-model="one-to-one">One-to-One</button>
        <button class="model-tab" data-model="many-to-many">Many-to-Many</button>
      </div>

      <!-- Controls -->
      <div class="controls-bar">
        <div class="control-group">
          <button class="btn btn-primary btn-sm" id="tm-add-thread">＋ Add Thread</button>
          <button class="btn btn-danger btn-sm" id="tm-remove-thread">－ Remove</button>
        </div>
        <div class="control-group">
          <span class="control-label">Kernel Threads</span>
          <input type="number" class="number-input" id="tm-kernel-count" value="1" min="1" max="8">
        </div>
        <div class="control-group" style="margin-left:auto;">
          <button class="btn btn-success btn-sm" id="tm-play">▶ Run</button>
          <button class="btn btn-secondary btn-sm" id="tm-step">⏭ Step</button>
          <button class="btn btn-danger btn-sm" id="tm-reset">↺ Reset</button>
        </div>
      </div>

      <!-- Visualization -->
      <div class="glass-card viz-container" id="tm-viz">
        <!-- User threads layer -->
        <div class="thread-layer">
          <div class="layer-label">👤 User-Level Threads</div>
          <div class="threads-row" id="tm-user-threads"></div>
        </div>

        <!-- Mapping SVG -->
        <div class="mapping-lines" id="tm-mapping-area">
          <svg class="connections-svg" id="tm-connections-svg"></svg>
        </div>

        <!-- Kernel threads layer -->
        <div class="thread-layer">
          <div class="layer-label">⚙️ Kernel-Level Threads</div>
          <div class="threads-row" id="tm-kernel-threads"></div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend" id="tm-legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-new)"></div> New</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-ready)"></div> Ready</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-running)"></div> Running</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-waiting)"></div> Waiting / Blocked</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-terminated)"></div> Terminated</div>
      </div>

      <!-- Event Log -->
      <div class="event-log" id="tm-log"></div>

      <!-- Info Panel -->
      <div class="info-panel">
        <button class="info-toggle" id="tm-info-toggle">
          <span>📖 Learn More — Threading Models</span>
          <span class="arrow">▼</span>
        </button>
        <div class="info-body" id="tm-info-body">
          <h4>Many-to-One Model</h4>
          <ul>
            <li>Multiple user-level threads are mapped to a <strong>single</strong> kernel thread.</li>
            <li>Thread management is done in user space — fast context switching.</li>
            <li><strong>Drawback:</strong> If any one thread makes a blocking system call, <em>all</em> threads are blocked since there is only one kernel thread.</li>
            <li>No true parallelism on multi-core systems.</li>
            <li>Example: Solaris Green Threads.</li>
          </ul>
          <h4>One-to-One Model</h4>
          <ul>
            <li>Each user thread is mapped to its <strong>own</strong> kernel thread.</li>
            <li>Provides true concurrency — one thread blocking doesn't affect others.</li>
            <li>Threads can run on different CPU cores in parallel.</li>
            <li><strong>Drawback:</strong> Creating a user thread requires creating a kernel thread (more overhead). OS may limit the number of threads.</li>
            <li>Examples: Windows, Linux (NPTL).</li>
          </ul>
          <h4>Many-to-Many Model</h4>
          <ul>
            <li>Many user threads are multiplexed onto a <strong>smaller or equal</strong> number of kernel threads.</li>
            <li>Best of both worlds — no blocking of entire process, and true parallelism.</li>
            <li>The OS or thread library dynamically assigns user threads to available kernel threads.</li>
            <li><strong>Drawback:</strong> Complex to implement.</li>
            <li>Example: Solaris LWP model, Windows ThreadFiber.</li>
          </ul>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Model sub-tabs
    this.container.querySelectorAll('.model-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.container.querySelectorAll('.model-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.model = tab.dataset.model;
        this.reset();
      });
    });

    // Buttons
    this.container.querySelector('#tm-add-thread').addEventListener('click', () => this.addThread());
    this.container.querySelector('#tm-remove-thread').addEventListener('click', () => this.removeThread());
    this.container.querySelector('#tm-play').addEventListener('click', () => this.toggleRun());
    this.container.querySelector('#tm-step').addEventListener('click', () => this.step());
    this.container.querySelector('#tm-reset').addEventListener('click', () => this.reset());

    // Kernel count change
    this.container.querySelector('#tm-kernel-count').addEventListener('change', (e) => {
      this.reset();
    });

    // Info toggle
    this.container.querySelector('#tm-info-toggle').addEventListener('click', () => {
      const toggle = this.container.querySelector('#tm-info-toggle');
      const body = this.container.querySelector('#tm-info-body');
      toggle.classList.toggle('open');
      body.classList.toggle('open');
    });
  }

  getKernelCount() {
    const model = this.model;
    if (model === 'many-to-one') return 1;
    if (model === 'one-to-one') return this.userThreads.length;
    // many-to-many: configurable
    return parseInt(this.container.querySelector('#tm-kernel-count').value) || 2;
  }

  reset() {
    this.stop();
    resetThreadIdCounter();
    this.userThreads = [];
    this.kernelThreads = [];
    this.logEntries = [];

    // Pre-populate threads
    const defaultCount = 4;
    for (let i = 0; i < defaultCount; i++) {
      const t = new Thread(`UT${i + 1}`, 'user');
      t.state = STATES.READY;
      this.userThreads.push(t);
    }

    // Update kernel count input visibility
    const kcInput = this.container.querySelector('#tm-kernel-count');
    if (this.model === 'many-to-one') {
      kcInput.value = 1;
      kcInput.disabled = true;
    } else if (this.model === 'one-to-one') {
      kcInput.value = this.userThreads.length;
      kcInput.disabled = true;
    } else {
      kcInput.disabled = false;
      kcInput.value = Math.max(parseInt(kcInput.value) || 2, 1);
    }

    this._rebuildKernelThreads();
    this._mapThreads();
    this._updateViz();
    this._log('System reset. Model: ' + this.model.replace(/-/g, ' ').toUpperCase(), 'info');
  }

  _rebuildKernelThreads() {
    const count = this.getKernelCount();
    this.kernelThreads = [];
    for (let i = 0; i < count; i++) {
      this.kernelThreads.push({
        id: i + 1,
        name: `KT${i + 1}`,
        busy: false,
        assignedThreads: [],
        currentThread: null,
      });
    }
  }

  _mapThreads() {
    // Clear assignments
    this.kernelThreads.forEach(kt => {
      kt.assignedThreads = [];
      kt.currentThread = null;
      kt.busy = false;
    });
    this.userThreads.forEach(ut => ut.mappedTo = null);

    const active = this.userThreads.filter(t => t.state !== STATES.TERMINATED);

    if (this.model === 'many-to-one') {
      // All user threads → single kernel thread
      if (this.kernelThreads.length > 0) {
        active.forEach(ut => {
          ut.mappedTo = this.kernelThreads[0].id;
          this.kernelThreads[0].assignedThreads.push(ut);
        });
      }
    } else if (this.model === 'one-to-one') {
      // 1:1 mapping
      active.forEach((ut, i) => {
        if (i < this.kernelThreads.length) {
          ut.mappedTo = this.kernelThreads[i].id;
          this.kernelThreads[i].assignedThreads.push(ut);
        }
      });
    } else {
      // Many-to-many: round-robin assignment
      active.forEach((ut, i) => {
        const ktIdx = i % this.kernelThreads.length;
        ut.mappedTo = this.kernelThreads[ktIdx].id;
        this.kernelThreads[ktIdx].assignedThreads.push(ut);
      });
    }
  }

  addThread() {
    if (this.userThreads.length >= 8) return;
    const t = new Thread(`UT${this.userThreads.length + 1}`, 'user');
    t.state = STATES.READY;
    this.userThreads.push(t);

    // For one-to-one, add a kernel thread too
    if (this.model === 'one-to-one') {
      this._rebuildKernelThreads();
      const kcInput = this.container.querySelector('#tm-kernel-count');
      kcInput.value = this.userThreads.length;
    }

    this._mapThreads();
    this._updateViz();
    this._log(`Thread ${t.name} created → READY`, 'success');
  }

  removeThread() {
    if (this.userThreads.length <= 1) return;
    const removed = this.userThreads.pop();
    if (this.model === 'one-to-one') {
      this._rebuildKernelThreads();
      const kcInput = this.container.querySelector('#tm-kernel-count');
      kcInput.value = this.userThreads.length;
    }
    this._mapThreads();
    this._updateViz();
    this._log(`Thread ${removed.name} removed`, 'warning');
  }

  toggleRun() {
    if (this.running) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const btn = this.container.querySelector('#tm-play');
    btn.textContent = '⏸ Pause';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    this.intervalId = setInterval(() => this.step(), this.speed);
  }

  stop() {
    this.running = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    const btn = this.container.querySelector('#tm-play');
    if (btn) {
      btn.textContent = '▶ Run';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-secondary');
    }
  }

  step() {
    const active = this.userThreads.filter(t => t.state !== STATES.TERMINATED);
    if (active.length === 0) {
      this.stop();
      this._log('All threads terminated.', 'warning');
      return;
    }

    // Simulate one step based on model
    if (this.model === 'many-to-one') {
      this._stepManyToOne();
    } else if (this.model === 'one-to-one') {
      this._stepOneToOne();
    } else {
      this._stepManyToMany();
    }

    this._updateViz();
  }

  _stepManyToOne() {
    const kt = this.kernelThreads[0];
    const active = this.userThreads.filter(t => t.state !== STATES.TERMINATED);

    // Check if any thread is blocked — if so, ALL are effectively blocked
    const blocked = active.find(t => t.state === STATES.WAITING);
    if (blocked) {
      // Unblock after a while
      if (Math.random() < 0.4) {
        blocked.state = STATES.READY;
        this._log(`${blocked.name} unblocked → READY (all threads resume)`, 'success');
      } else {
        this._log(`${blocked.name} still blocked — ALL threads stalled!`, 'error');
        return;
      }
    }

    // Find currently running thread
    let running = active.find(t => t.state === STATES.RUNNING);

    if (running) {
      // Randomly: continue, block, or finish
      const roll = Math.random();
      if (roll < 0.15) {
        // Block
        running.state = STATES.WAITING;
        kt.busy = false;
        this._log(`${running.name} BLOCKED! (entire process stalls in Many-to-One)`, 'error');
      } else if (roll < 0.3) {
        // Terminate
        running.state = STATES.TERMINATED;
        running.burstRemaining = 0;
        kt.busy = false;
        this._log(`${running.name} → TERMINATED`, 'warning');
      } else {
        // Context switch to another ready thread
        running.state = STATES.READY;
        const ready = active.filter(t => t.state === STATES.READY && t !== running);
        if (ready.length > 0) {
          const next = ready[Math.floor(Math.random() * ready.length)];
          next.state = STATES.RUNNING;
          kt.currentThread = next;
          this._log(`Context switch: ${running.name} → ${next.name} (RUNNING)`, 'info');
        } else {
          running.state = STATES.RUNNING; // keep running
          this._log(`${running.name} continues (no other ready threads)`, 'info');
        }
      }
    } else {
      // Pick a ready thread to run
      const ready = active.filter(t => t.state === STATES.READY);
      if (ready.length > 0) {
        const next = ready[0];
        next.state = STATES.RUNNING;
        kt.currentThread = next;
        kt.busy = true;
        this._log(`${next.name} → RUNNING (on single kernel thread)`, 'info');
      }
    }
  }

  _stepOneToOne() {
    // Each user thread can independently run on its own kernel thread
    this.kernelThreads.forEach(kt => {
      const assigned = kt.assignedThreads.filter(t => t.state !== STATES.TERMINATED);
      if (assigned.length === 0) return;

      const thread = assigned[0]; // 1:1 so there is only one

      if (thread.state === STATES.WAITING) {
        if (Math.random() < 0.5) {
          thread.state = STATES.READY;
          this._log(`${thread.name} unblocked → READY`, 'success');
        }
        return;
      }

      if (thread.state === STATES.RUNNING) {
        const roll = Math.random();
        if (roll < 0.12) {
          thread.state = STATES.WAITING;
          this._log(`${thread.name} BLOCKED (only this thread affected)`, 'warning');
        } else if (roll < 0.25) {
          thread.state = STATES.TERMINATED;
          this._log(`${thread.name} → TERMINATED`, 'warning');
        } else {
          this._log(`${thread.name} running on ${kt.name}`, 'info');
        }
      } else if (thread.state === STATES.READY) {
        thread.state = STATES.RUNNING;
        kt.currentThread = thread;
        this._log(`${thread.name} → RUNNING on ${kt.name}`, 'info');
      }
    });
  }

  _stepManyToMany() {
    // Dynamically reassign threads to kernel threads
    this._mapThreads();

    this.kernelThreads.forEach(kt => {
      const threads = kt.assignedThreads.filter(t => t.state !== STATES.TERMINATED);
      if (threads.length === 0) return;

      let running = threads.find(t => t.state === STATES.RUNNING);

      if (running) {
        const roll = Math.random();
        if (roll < 0.1) {
          running.state = STATES.WAITING;
          this._log(`${running.name} BLOCKED on ${kt.name} (other threads can be reassigned)`, 'warning');
          // Reassign a ready thread if available
          const ready = threads.filter(t => t.state === STATES.READY);
          if (ready.length > 0) {
            ready[0].state = STATES.RUNNING;
            kt.currentThread = ready[0];
            this._log(`${ready[0].name} takes over ${kt.name}`, 'success');
          }
        } else if (roll < 0.22) {
          running.state = STATES.TERMINATED;
          this._log(`${running.name} → TERMINATED`, 'warning');
          const ready = threads.filter(t => t.state === STATES.READY);
          if (ready.length > 0) {
            ready[0].state = STATES.RUNNING;
            kt.currentThread = ready[0];
          }
        } else if (roll < 0.45) {
          // Context switch within this KT's assigned threads
          running.state = STATES.READY;
          const ready = threads.filter(t => t.state === STATES.READY);
          if (ready.length > 0) {
            const next = ready[Math.floor(Math.random() * ready.length)];
            next.state = STATES.RUNNING;
            kt.currentThread = next;
            this._log(`${kt.name}: switch ${running.name} → ${next.name}`, 'info');
          } else {
            running.state = STATES.RUNNING;
          }
        } else {
          this._log(`${running.name} running on ${kt.name}`, 'info');
        }
      } else {
        // Unblock waiting threads
        const waiting = threads.filter(t => t.state === STATES.WAITING);
        waiting.forEach(t => {
          if (Math.random() < 0.4) {
            t.state = STATES.READY;
            this._log(`${t.name} unblocked → READY`, 'success');
          }
        });

        const ready = threads.filter(t => t.state === STATES.READY);
        if (ready.length > 0) {
          ready[0].state = STATES.RUNNING;
          kt.currentThread = ready[0];
          this._log(`${ready[0].name} → RUNNING on ${kt.name}`, 'info');
        }
      }
    });
  }

  _log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.logEntries.push({ time, message, type });
    if (this.logEntries.length > 50) this.logEntries.shift();
    this._renderLog();
  }

  _renderLog() {
    const logEl = this.container.querySelector('#tm-log');
    logEl.innerHTML = this.logEntries.map(e =>
      `<div class="log-entry log-${e.type}">
        <span class="log-time">[${e.time}]</span>
        <span class="log-thread">${e.message}</span>
      </div>`
    ).reverse().join('');
  }

  _updateViz() {
    // Render user threads
    const userRow = this.container.querySelector('#tm-user-threads');
    userRow.innerHTML = this.userThreads.map(t => `
      <div class="thread-node anim-scale-pop" data-thread-id="${t.id}">
        <div class="thread-circle" data-state="${t.state}" title="Click to block/unblock">${t.name}</div>
        <span class="thread-label">${t.state}</span>
      </div>
    `).join('');

    // Click to block/unblock user threads
    userRow.querySelectorAll('.thread-node').forEach(node => {
      node.addEventListener('click', () => {
        const id = parseInt(node.dataset.threadId);
        const t = this.userThreads.find(th => th.id === id);
        if (!t) return;
        if (t.state === STATES.RUNNING || t.state === STATES.READY) {
          t.state = STATES.WAITING;
          this._log(`${t.name} manually BLOCKED`, 'error');
        } else if (t.state === STATES.WAITING) {
          t.state = STATES.READY;
          this._log(`${t.name} manually UNBLOCKED → READY`, 'success');
        }
        this._updateViz();
      });
    });

    // Render kernel threads
    const kernelRow = this.container.querySelector('#tm-kernel-threads');
    kernelRow.innerHTML = this.kernelThreads.map(kt => {
      const running = kt.assignedThreads.find(t => t.state === STATES.RUNNING);
      const state = running ? STATES.RUNNING : (kt.assignedThreads.some(t => t.state === STATES.WAITING) ? STATES.WAITING : STATES.READY);
      return `
        <div class="thread-node">
          <div class="thread-circle kernel" data-state="${state}">${kt.name}</div>
          <span class="thread-label">${running ? `← ${running.name}` : 'idle'}</span>
        </div>
      `;
    }).join('');

    // Draw connection lines
    this._drawConnections();
  }

  _drawConnections() {
    const svg = this.container.querySelector('#tm-connections-svg');
    const userRow = this.container.querySelector('#tm-user-threads');
    const kernelRow = this.container.querySelector('#tm-kernel-threads');
    const mappingArea = this.container.querySelector('#tm-mapping-area');

    const mapRect = mappingArea.getBoundingClientRect();

    let lines = '';
    this.userThreads.forEach(ut => {
      if (ut.mappedTo === null || ut.state === STATES.TERMINATED) return;

      const utNode = userRow.querySelector(`[data-thread-id="${ut.id}"] .thread-circle`);
      const ktIdx = this.kernelThreads.findIndex(kt => kt.id === ut.mappedTo);
      const ktNode = kernelRow.children[ktIdx]?.querySelector('.thread-circle');

      if (!utNode || !ktNode) return;

      const utRect = utNode.getBoundingClientRect();
      const ktRect = ktNode.getBoundingClientRect();

      const x1 = utRect.left + utRect.width / 2 - mapRect.left;
      const y1 = 0;
      const x2 = ktRect.left + ktRect.width / 2 - mapRect.left;
      const y2 = mapRect.height;

      const color = STATE_COLORS[ut.state] || '#6b7280';
      const opacity = ut.state === STATES.RUNNING ? 0.8 : 0.3;

      lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
        stroke="${color}" stroke-width="${ut.state === STATES.RUNNING ? 2.5 : 1.5}"
        stroke-opacity="${opacity}" />`;
    });

    svg.innerHTML = lines;
  }
}
