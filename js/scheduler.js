// ============================================================
// scheduler.js — Round Robin CPU Scheduler + Gantt Chart
// ============================================================
import { Thread, STATES, STATE_COLORS } from './utils.js';

export class SchedulerSimulator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.threads = [];
    this.readyQueue = [];
    this.currentThread = null;
    this.timeQuantum = 3;
    this.currentQuantumUsed = 0;
    this.clock = 0;
    this.ganttData = [];     // { threadName, startTime, endTime, color }
    this.running = false;
    this.intervalId = null;
    this.logEntries = [];
    this.threadCounter = 0;
    this.speed = 600;
    this.completedThreads = [];
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
          <span class="control-label">Time Quantum</span>
          <input type="number" class="number-input" id="sch-quantum" value="3" min="1" max="10">
        </div>
        <div class="control-group">
          <span class="control-label">Threads</span>
          <input type="number" class="number-input" id="sch-thread-count" value="4" min="2" max="8">
        </div>
        <div class="control-group" style="margin-left:auto;">
          <button class="btn btn-success btn-sm" id="sch-play">▶ Run</button>
          <button class="btn btn-secondary btn-sm" id="sch-step">⏭ Step</button>
          <button class="btn btn-danger btn-sm" id="sch-reset">↺ Reset</button>
        </div>
      </div>

      <!-- Thread Table + Gantt -->
      <div class="glass-card">
        <!-- Thread status table -->
        <div style="overflow-x:auto;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
            <thead>
              <tr style="border-bottom:1px solid var(--bg-glass-border);">
                <th style="text-align:left;padding:8px 12px;color:var(--text-muted);font-weight:600;">Thread</th>
                <th style="text-align:center;padding:8px 12px;color:var(--text-muted);font-weight:600;">Burst</th>
                <th style="text-align:center;padding:8px 12px;color:var(--text-muted);font-weight:600;">Remaining</th>
                <th style="text-align:center;padding:8px 12px;color:var(--text-muted);font-weight:600;">State</th>
                <th style="text-align:center;padding:8px 12px;color:var(--text-muted);font-weight:600;">Wait Time</th>
              </tr>
            </thead>
            <tbody id="sch-thread-table"></tbody>
          </table>
        </div>

        <!-- Clock -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
          <div style="font-family:var(--font-mono);font-size:1.4rem;font-weight:800;color:var(--accent-cyan);">
            Clock: <span id="sch-clock">0</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);">
            Quantum Used: <span id="sch-quantum-used" style="color:var(--accent-amber);font-weight:600;">0</span> / <span id="sch-quantum-max">3</span>
          </div>
        </div>

        <!-- Gantt Chart -->
        <div class="layer-label">📊 Gantt Chart (CPU Timeline)</div>
        <div class="gantt-container" id="sch-gantt-container">
          <div class="gantt-chart" id="sch-gantt"></div>
        </div>

        <!-- Ready Queue visual -->
        <div style="margin-top:24px;">
          <div class="layer-label">📋 Ready Queue</div>
          <div class="threads-row" id="sch-ready-queue" style="min-height:60px;"></div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-ready)"></div> Ready</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-running)"></div> Running</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--state-terminated)"></div> Terminated</div>
      </div>

      <!-- Event Log -->
      <div class="event-log" id="sch-log"></div>

      <!-- Info Panel -->
      <div class="info-panel">
        <button class="info-toggle" id="sch-info-toggle">
          <span>📖 Learn More — CPU Scheduling (Round Robin)</span>
          <span class="arrow">▼</span>
        </button>
        <div class="info-body" id="sch-info-body">
          <h4>Round Robin Scheduling</h4>
          <ul>
            <li>Round Robin (RR) is a <strong>preemptive</strong> scheduling algorithm designed for time-sharing systems.</li>
            <li>Each thread gets a fixed time slice called the <strong>time quantum</strong> (or time slice).</li>
            <li>Threads are placed in a circular <strong>ready queue</strong>. The CPU scheduler picks the first thread, sets a timer for the quantum, and lets it execute.</li>
          </ul>
          <h4>How it Works</h4>
          <ul>
            <li>If the thread completes before the quantum expires → it terminates and the CPU moves to the next thread.</li>
            <li>If the quantum expires before completion → the thread is <strong>preempted</strong>, moved to the back of the ready queue, and the next thread runs.</li>
            <li>This ensures <strong>fairness</strong> — no thread starves, every thread gets CPU time.</li>
          </ul>
          <h4>Time Quantum Trade-offs</h4>
          <ul>
            <li><strong>Small quantum:</strong> More context switches (overhead), but better response time.</li>
            <li><strong>Large quantum:</strong> Fewer switches, but behaves like FCFS (First Come First Served) and hurts responsiveness.</li>
            <li>Typical values: 10–100 milliseconds in real systems.</li>
          </ul>
          <h4>Metrics</h4>
          <ul>
            <li><strong>Wait Time:</strong> Total time a thread spends in the ready queue.</li>
            <li><strong>Turnaround Time:</strong> Total time from arrival to completion.</li>
          </ul>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.container.querySelector('#sch-play').addEventListener('click', () => this.toggleRun());
    this.container.querySelector('#sch-step').addEventListener('click', () => this.step());
    this.container.querySelector('#sch-reset').addEventListener('click', () => this.reset());

    this.container.querySelector('#sch-info-toggle').addEventListener('click', () => {
      this.container.querySelector('#sch-info-toggle').classList.toggle('open');
      this.container.querySelector('#sch-info-body').classList.toggle('open');
    });
  }

  reset() {
    this.stop();
    this.threads = [];
    this.readyQueue = [];
    this.currentThread = null;
    this.completedThreads = [];
    this.ganttData = [];
    this.clock = 0;
    this.currentQuantumUsed = 0;
    this.logEntries = [];
    this.threadCounter = 0;
    this.timeQuantum = parseInt(this.container.querySelector('#sch-quantum').value) || 3;
    const threadCount = parseInt(this.container.querySelector('#sch-thread-count').value) || 4;

    // Thread colors for Gantt
    const colors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6', '#ec4899', '#14b8a6'];

    for (let i = 0; i < threadCount; i++) {
      this.threadCounter++;
      const t = new Thread(`P${this.threadCounter}`, 'user');
      t.state = STATES.READY;
      t.burstRemaining = Math.floor(Math.random() * 8) + 2; // 2-9
      t.totalBurst = t.burstRemaining;
      t.waitTime = 0;
      t.ganttColor = colors[i % colors.length];
      this.threads.push(t);
      this.readyQueue.push(t);
    }

    this._updateViz();
    this._log(`Reset. ${threadCount} threads, quantum = ${this.timeQuantum}`, 'info');
  }

  toggleRun() {
    if (this.running) this.stop(); else this.start();
  }

  start() {
    this.running = true;
    const btn = this.container.querySelector('#sch-play');
    btn.textContent = '⏸ Pause';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    this.intervalId = setInterval(() => this.step(), this.speed);
  }

  stop() {
    this.running = false;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    const btn = this.container.querySelector('#sch-play');
    if (btn) {
      btn.textContent = '▶ Run';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-secondary');
    }
  }

  step() {
    // Check if all done
    const allDone = this.threads.every(t => t.state === STATES.TERMINATED);
    if (allDone) {
      this.stop();
      this._log('All threads completed! Scheduling finished.', 'warning');
      this._updateViz();
      return;
    }

    // If no current thread, pick from ready queue
    if (!this.currentThread) {
      if (this.readyQueue.length > 0) {
        this.currentThread = this.readyQueue.shift();
        this.currentThread.state = STATES.RUNNING;
        this.currentQuantumUsed = 0;
        this._log(`${this.currentThread.name} → RUNNING (burst remaining: ${this.currentThread.burstRemaining})`, 'info');
      } else {
        this.clock++;
        this._log(`Clock ${this.clock}: CPU idle (no ready threads)`, 'warning');
        this._updateViz();
        return;
      }
    }

    // Execute one time unit
    this.clock++;
    this.currentQuantumUsed++;
    this.currentThread.burstRemaining--;

    // Increment wait time for all threads in ready queue
    this.readyQueue.forEach(t => { if (t.state === STATES.READY) t.waitTime++; });

    // Add to Gantt
    const lastGantt = this.ganttData[this.ganttData.length - 1];
    if (lastGantt && lastGantt.threadName === this.currentThread.name && lastGantt.endTime === this.clock - 1) {
      lastGantt.endTime = this.clock;
    } else {
      this.ganttData.push({
        threadName: this.currentThread.name,
        startTime: this.clock - 1,
        endTime: this.clock,
        color: this.currentThread.ganttColor,
      });
    }

    // Check if thread completed
    if (this.currentThread.burstRemaining <= 0) {
      this.currentThread.state = STATES.TERMINATED;
      this.completedThreads.push(this.currentThread);
      this._log(`Clock ${this.clock}: ${this.currentThread.name} → TERMINATED (completed!)`, 'success');
      this.currentThread = null;
      this.currentQuantumUsed = 0;
    }
    // Check if quantum expired
    else if (this.currentQuantumUsed >= this.timeQuantum) {
      this.currentThread.state = STATES.READY;
      this.readyQueue.push(this.currentThread);
      this._log(`Clock ${this.clock}: ${this.currentThread.name} preempted (quantum expired, remaining: ${this.currentThread.burstRemaining}) → back to Ready Queue`, 'warning');
      this.currentThread = null;
      this.currentQuantumUsed = 0;
    } else {
      this._log(`Clock ${this.clock}: ${this.currentThread.name} running (${this.currentQuantumUsed}/${this.timeQuantum} quantum, remaining: ${this.currentThread.burstRemaining})`, 'info');
    }

    this._updateViz();
  }

  _log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.logEntries.push({ time, message, type });
    if (this.logEntries.length > 80) this.logEntries.shift();
    const logEl = this.container.querySelector('#sch-log');
    logEl.innerHTML = this.logEntries.map(e =>
      `<div class="log-entry log-${e.type}">
        <span class="log-time">[${e.time}]</span>
        <span class="log-thread">${e.message}</span>
      </div>`
    ).reverse().join('');
  }

  _updateViz() {
    // Clock display
    this.container.querySelector('#sch-clock').textContent = this.clock;
    this.container.querySelector('#sch-quantum-used').textContent = this.currentQuantumUsed;
    this.container.querySelector('#sch-quantum-max').textContent = this.timeQuantum;

    // Thread table
    const tbody = this.container.querySelector('#sch-thread-table');
    tbody.innerHTML = this.threads.map(t => {
      const stateClass = `state-${t.state.toLowerCase()}`;
      const progress = t.totalBurst > 0 ? ((t.totalBurst - t.burstRemaining) / t.totalBurst * 100) : 100;
      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          <td style="padding:8px 12px;">
            <span style="display:inline-flex;align-items:center;gap:8px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${t.ganttColor};display:inline-block;"></span>
              <span style="font-family:var(--font-mono);font-weight:600;">${t.name}</span>
            </span>
          </td>
          <td style="text-align:center;padding:8px 12px;font-family:var(--font-mono);">${t.totalBurst}</td>
          <td style="text-align:center;padding:8px 12px;">
            <div style="display:flex;align-items:center;gap:6px;justify-content:center;">
              <div style="width:60px;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;">
                <div style="width:${progress}%;height:100%;background:${t.ganttColor};border-radius:3px;transition:width 0.3s;"></div>
              </div>
              <span style="font-family:var(--font-mono);font-size:0.75rem;">${t.burstRemaining}</span>
            </div>
          </td>
          <td style="text-align:center;padding:8px 12px;">
            <span class="state-badge ${stateClass}">${t.state}</span>
          </td>
          <td style="text-align:center;padding:8px 12px;font-family:var(--font-mono);font-size:0.8rem;">${t.waitTime}</td>
        </tr>
      `;
    }).join('');

    // Ready queue visual
    const readyEl = this.container.querySelector('#sch-ready-queue');
    const queueItems = this.readyQueue.map(t => `
      <div class="thread-node anim-scale-pop">
        <div class="thread-circle" data-state="Ready" style="background:${t.ganttColor};box-shadow:0 0 12px ${t.ganttColor}44;">${t.name}</div>
        <span class="thread-label">Burst: ${t.burstRemaining}</span>
      </div>
    `).join('');

    const runningItem = this.currentThread ? `
      <div class="thread-node" style="order:-1;">
        <div class="thread-circle" data-state="Running" style="background:${this.currentThread.ganttColor};box-shadow:0 0 16px ${this.currentThread.ganttColor}88;width:52px;height:52px;font-size:0.85rem;">${this.currentThread.name}</div>
        <span class="thread-label" style="color:var(--accent-amber);">▶ Running</span>
      </div>
    ` : '';

    readyEl.innerHTML = runningItem + (queueItems || '<div class="empty-state" style="padding:12px 0;font-size:0.8rem;">Queue empty</div>');

    // Gantt chart
    this._renderGantt();
  }

  _renderGantt() {
    const ganttEl = this.container.querySelector('#sch-gantt');
    if (this.ganttData.length === 0) {
      ganttEl.innerHTML = '<div class="empty-state" style="padding:24px;font-size:0.85rem;">Run the scheduler to see the Gantt chart</div>';
      return;
    }

    const maxTime = this.clock;
    const unitWidth = Math.max(30, Math.min(50, 600 / maxTime));

    // Get unique threads to create rows
    const threadNames = [...new Set(this.threads.map(t => t.name))];

    let html = '';

    // Thread rows
    threadNames.forEach(name => {
      const thread = this.threads.find(t => t.name === name);
      const blocks = this.ganttData.filter(g => g.threadName === name);

      html += `<div class="gantt-row">
        <div class="gantt-label">${name}</div>
        <div class="gantt-track" style="min-width:${maxTime * unitWidth}px;">`;

      let lastEnd = 0;
      blocks.forEach(block => {
        const gapWidth = (block.startTime - lastEnd) * unitWidth;
        if (gapWidth > 0) {
          html += `<div style="width:${gapWidth}px;flex-shrink:0;"></div>`;
        }
        const width = (block.endTime - block.startTime) * unitWidth;
        html += `<div class="gantt-block" style="width:${width}px;background:${block.color};flex-shrink:0;">${block.endTime - block.startTime > 1 ? name : ''}</div>`;
        lastEnd = block.endTime;
      });

      html += `</div></div>`;
    });

    // Time axis
    html += `<div class="gantt-time-axis" style="min-width:${maxTime * unitWidth + 58}px;">`;
    html += `<div style="width:58px;flex-shrink:0;"></div>`;
    for (let i = 0; i <= maxTime; i++) {
      html += `<div class="gantt-tick" style="width:${unitWidth}px;flex-shrink:0;">${i}</div>`;
    }
    html += `</div>`;

    ganttEl.innerHTML = html;

    // Auto scroll to right
    const container = this.container.querySelector('#sch-gantt-container');
    container.scrollLeft = container.scrollWidth;
  }
}
