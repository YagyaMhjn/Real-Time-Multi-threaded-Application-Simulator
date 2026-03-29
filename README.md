# Real-Time Multithreading Application Simulator

An interactive web-based simulator that demonstrates core Operating System concepts related to multithreading, thread synchronization, and CPU scheduling.

**🔗 [Live Demo](#)** *(Update with your Vercel deployment URL)*

---

## Features

### 🔗 Threading Models
Visualize how user-level threads map to kernel-level threads:
- **Many-to-One**: Multiple user threads → single kernel thread. Blocking one blocks all.
- **One-to-One**: Each user thread has its own kernel thread. True parallelism.
- **Many-to-Many**: User threads multiplexed onto fewer kernel threads. Best of both worlds.

Interactive: Add/remove threads, click to block/unblock, run or step through simulation.

### 🚦 Semaphore Synchronization
- Binary (mutex) and counting semaphore modes.
- Watch threads enter/exit a critical section.
- Visual waiting queue, semaphore counter, and completion tracking.
- Demonstrates `wait()` / `signal()` (P/V) operations.

### 🔒 Monitor Synchronization
- Implicit lock with automatic mutual exclusion.
- Condition variables with `wait()` and `signal()`.
- Entry queue, monitor lock indicator, and condition wait queue.
- Visual comparison with semaphore approach.

### ⏱️ CPU Scheduling — Round Robin
- Configurable time quantum and thread count.
- Real-time Gantt chart showing CPU allocation.
- Thread table with burst time, remaining time, state badges, and wait time.
- Ready queue visualization.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 |
| Styling | Vanilla CSS (Dark theme, Glassmorphism) |
| Logic | Vanilla JavaScript (ES6 Modules) |
| Deployment | Vercel (Static Site) |

**No dependencies. No build step. No npm install needed.**

---

## Project Structure

```
├── index.html              # Main entry point
├── css/
│   ├── style.css           # Design system & component styles
│   └── animations.css      # Keyframe animations
├── js/
│   ├── app.js              # App controller & navigation
│   ├── threadingModels.js   # Threading model simulator
│   ├── synchronization.js  # Semaphore & Monitor simulators
│   ├── scheduler.js        # Round Robin scheduler
│   └── utils.js            # Thread class & shared utilities
└── README.md
```

---

## Running Locally

Simply open `index.html` in a browser, or serve it locally:

```bash
npx serve .
```

Then visit `http://localhost:3000`.

---

## Deploy on Vercel

1. Push this project to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), click **Add New → Project**.
3. Import your GitHub repo.
4. Framework Preset: **Other** (it auto-detects as static).
5. Click **Deploy**. Done!

---

## OS Concepts Covered

- Multithreading Models (Many-to-One, One-to-One, Many-to-Many)
- Thread States (New, Ready, Running, Waiting, Terminated)
- Thread Synchronization (Semaphores, Monitors)
- Critical Section Problem
- Condition Variables
- CPU Scheduling (Round Robin with Time Quantum)
- Gantt Chart Visualization
- Context Switching

---

## License

This project is created for educational purposes as part of an Operating Systems course.
