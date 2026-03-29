// ============================================================
// app.js — Main Application Controller
// ============================================================
import { ThreadingModelSimulator } from './threadingModels.js';
import { SemaphoreSimulator, MonitorSimulator } from './synchronization.js';
import { SchedulerSimulator } from './scheduler.js';

class App {
  constructor() {
    this.currentTab = 'threading-models';
    this.simulators = {};
    this._init();
  }

  _init() {
    this._bindNavigation();
    this._initSimulators();
    this._showSection(this.currentTab);

    // Handle window resize (for connection line SVG repositioning)
    window.addEventListener('resize', () => {
      if (this.simulators.threadingModels) {
        this.simulators.threadingModels._drawConnections();
      }
    });

    console.log('🧵 Multithreading Simulator initialized');
  }

  _bindNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.section;
        if (target) {
          this._showSection(target);
        }
      });
    });
  }

  _showSection(sectionId) {
    this.currentTab = sectionId;

    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });

    // Show/hide sections
    document.querySelectorAll('.section').forEach(section => {
      section.classList.toggle('active', section.id === sectionId);
    });
  }

  _initSimulators() {
    // Threading Models
    this.simulators.threadingModels = new ThreadingModelSimulator('threading-models-content');

    // Semaphore
    this.simulators.semaphore = new SemaphoreSimulator('semaphore-content');

    // Monitor
    this.simulators.monitor = new MonitorSimulator('monitor-content');

    // CPU Scheduler
    this.simulators.scheduler = new SchedulerSimulator('scheduler-content');
  }
}

// Boot the app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
