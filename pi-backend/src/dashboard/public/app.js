// Slackwater Admin Dashboard
// Frontend JavaScript (Vanilla JS + Chart.js)

// State management
const state = {
  authenticated: false,
  autoRefresh: false,
  refreshInterval: null,
  currentTab: 'system',
  logsPage: 1,
  logsSearch: '',
  charts: {}
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  setupEventListeners();
});

// Check if user is authenticated
async function checkAuthentication() {
  try {
    const response = await fetch('/admin/check-auth', { credentials: 'include' });
    const data = await response.json();

    if (data.authenticated) {
      state.authenticated = true;
      showDashboard();
      loadAllData();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLogin();
  }
}

// Show login page
function showLogin() {
  document.getElementById('login-page').classList.add('active');
  document.getElementById('dashboard-page').classList.remove('active');
}

// Show dashboard page
function showDashboard() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.add('active');
}

// Setup event listeners
function setupEventListeners() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Auto-refresh toggle
  document.getElementById('auto-refresh').addEventListener('change', (e) => {
    state.autoRefresh = e.target.checked;
    if (state.autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  // Logs search
  document.getElementById('search-btn').addEventListener('click', handleLogsSearch);
  document.getElementById('clear-search-btn').addEventListener('click', handleLogsClear);
  document.getElementById('log-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogsSearch();
  });

  // Pagination
  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (state.logsPage > 1) {
      state.logsPage--;
      loadRequestLogs();
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    state.logsPage++;
    loadRequestLogs();
  });
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');

  errorEl.textContent = '';

  try {
    const response = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {
      state.authenticated = true;
      showDashboard();
      loadAllData();
    } else {
      errorEl.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = 'Network error. Please try again.';
  }
}

// Handle logout
async function handleLogout() {
  try {
    await fetch('/admin/logout', { method: 'POST', credentials: 'include' });
    state.authenticated = false;
    stopAutoRefresh();
    showLogin();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Switch tabs
function switchTab(tabName) {
  state.currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });

  // Load tab-specific data
  loadTabData(tabName);
}

// Load all dashboard data
function loadAllData() {
  loadSystemStats();
  loadPipelineData();
  loadAnalytics();
  loadRequestLogs();
  updateLastUpdated();
}

// Load tab-specific data
function loadTabData(tabName) {
  switch (tabName) {
    case 'system':
      loadSystemStats();
      break;
    case 'pipeline':
      loadPipelineData();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'logs':
      loadRequestLogs();
      break;
  }
  updateLastUpdated();
}

// Load system stats
async function loadSystemStats() {
  try {
    const response = await fetch('/admin/api/system/stats', { credentials: 'include' });
    const data = await response.json();

    if (data.error) throw new Error(data.error);

    // CPU
    document.getElementById('cpu-usage').textContent = `${data.cpu.usage}%`;
    document.getElementById('cpu-cores').textContent = `${data.cpu.cores} cores`;
    document.getElementById('cpu-model').textContent = data.cpu.model;

    // Memory
    const memoryGB = (data.memory.used / 1024 / 1024 / 1024).toFixed(1);
    const totalMemoryGB = (data.memory.total / 1024 / 1024 / 1024).toFixed(1);
    document.getElementById('memory-usage').textContent = `${data.memory.usedPercent}%`;
    document.getElementById('memory-total').textContent = `${memoryGB} GB / ${totalMemoryGB} GB`;

    // Disk
    document.getElementById('disk-usage').textContent = `${data.disk.usedPercent}%`;
    document.getElementById('disk-total').textContent = `${data.disk.used} / ${data.disk.total}`;

    // Temperature
    document.getElementById('temperature').textContent = data.temperature
      ? `${data.temperature.toFixed(1)}°C`
      : 'N/A';

    // System info
    document.getElementById('hostname').textContent = data.hostname;
    document.getElementById('platform').textContent = data.platform;
    document.getElementById('system-uptime').textContent = formatUptime(data.uptime.system);
    document.getElementById('process-uptime').textContent = formatUptime(data.uptime.process);
  } catch (error) {
    console.error('Failed to load system stats:', error);
  }
}

// Load pipeline data
async function loadPipelineData() {
  try {
    // Load cache stats
    const cacheResponse = await fetch('/admin/api/pipeline/cache-stats', { credentials: 'include' });
    const cacheData = await cacheResponse.json();

    if (!cacheData.error) {
      document.getElementById('cache-entries').textContent = cacheData.cache.totalEntries;
      document.getElementById('cache-valid').textContent = `${cacheData.cache.validEntries} valid`;
      document.getElementById('cache-hit-rate').textContent = `${cacheData.fetches.hitRate}%`;
      document.getElementById('total-fetches').textContent = cacheData.fetches.totalFetches;
      document.getElementById('fetch-errors').textContent = `${cacheData.fetches.errors} errors`;
      document.getElementById('avg-response-time').textContent = `${cacheData.fetches.avgResponseTime}ms`;
    }

    // Load station health
    const stationsResponse = await fetch('/admin/api/pipeline/stations', { credentials: 'include' });
    const stations = await stationsResponse.json();

    if (!stations.error) {
      renderStationHealth(stations);
    }

    // Load fetch logs
    const logsResponse = await fetch('/admin/api/pipeline/fetch-logs?limit=50', { credentials: 'include' });
    const logs = await logsResponse.json();

    if (!logs.error) {
      renderFetchLogs(logs);
    }
  } catch (error) {
    console.error('Failed to load pipeline data:', error);
  }
}

// Load analytics
async function loadAnalytics() {
  try {
    // Load overview
    const overviewResponse = await fetch('/admin/api/analytics/overview?days=7', { credentials: 'include' });
    const overview = await overviewResponse.json();

    if (!overview.error) {
      document.getElementById('total-pageviews').textContent = overview.totalPageviews;
      document.getElementById('total-sessions').textContent = overview.totalSessions;
      document.getElementById('analytics-response-time').textContent = `${overview.avgResponseTime}ms`;
      document.getElementById('total-errors').textContent = overview.totalErrors;
    }

    // Load traffic data
    const trafficResponse = await fetch('/admin/api/analytics/traffic?days=7', { credentials: 'include' });
    const traffic = await trafficResponse.json();

    if (!traffic.error) {
      renderTrafficChart(traffic);
    }

    // Load device breakdown
    const devicesResponse = await fetch('/admin/api/analytics/devices?days=7', { credentials: 'include' });
    const devices = await devicesResponse.json();

    if (!devices.error) {
      renderDeviceChart(devices);
    }

    // Load popular stations
    const stationsResponse = await fetch('/admin/api/analytics/popular-stations?limit=10', { credentials: 'include' });
    const stations = await stationsResponse.json();

    if (!stations.error) {
      renderStationsChart(stations);
    }
  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
}

// Load request logs
async function loadRequestLogs() {
  try {
    const limit = 100;
    const offset = (state.logsPage - 1) * limit;
    const search = state.logsSearch ? `&search=${encodeURIComponent(state.logsSearch)}` : '';

    const response = await fetch(`/admin/api/logs/requests?limit=${limit}&offset=${offset}${search}`, { credentials: 'include' });
    const logs = await response.json();

    if (!logs.error) {
      renderRequestLogs(logs);
      updatePagination(logs.length);
    }
  } catch (error) {
    console.error('Failed to load request logs:', error);
  }
}

// Render station health table
function renderStationHealth(stations) {
  const tbody = document.querySelector('#station-health-table tbody');

  if (stations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No station data available</td></tr>';
    return;
  }

  tbody.innerHTML = stations.map(station => {
    const successRate = station.total_successes + station.total_failures > 0
      ? ((station.total_successes / (station.total_successes + station.total_failures)) * 100).toFixed(1)
      : '0.0';

    const statusClass = station.is_healthy ? 'status-healthy' : 'status-unhealthy';
    const statusText = station.is_healthy ? 'Healthy' : 'Unhealthy';

    return `
      <tr>
        <td>${station.station_id || 'Unknown'}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${station.consecutive_failures}</td>
        <td>${successRate}%</td>
        <td>${formatDate(station.last_successful_fetch)}</td>
      </tr>
    `;
  }).join('');
}

// Render fetch logs table
function renderFetchLogs(logs) {
  const tbody = document.querySelector('#fetch-logs-table tbody');

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No fetch logs available</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const cacheClass = log.cache_hit ? 'cache-hit' : 'cache-miss';
    const cacheText = log.cache_hit ? 'Hit' : 'Miss';

    return `
      <tr>
        <td>${formatDate(log.created_at)}</td>
        <td>${log.endpoint || 'N/A'}</td>
        <td>${log.station_id || 'N/A'}</td>
        <td>${log.external_api || 'N/A'}</td>
        <td>${log.status_code || 'N/A'}</td>
        <td>${log.response_time_ms || 'N/A'}ms</td>
        <td><span class="${cacheClass}">${cacheText}</span></td>
      </tr>
    `;
  }).join('');
}

// Render request logs table
function renderRequestLogs(logs) {
  const tbody = document.querySelector('#request-logs-table tbody');

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No request logs available</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${formatDate(log.created_at)}</td>
      <td>${log.endpoint || 'N/A'}</td>
      <td>${log.station_id || 'N/A'}</td>
      <td>${log.feature_used || 'N/A'}</td>
      <td>${log.device_type || 'N/A'}</td>
      <td>${log.response_time_ms || 'N/A'}ms</td>
    </tr>
  `).join('');
}

// Render traffic chart
function renderTrafficChart(data) {
  const ctx = document.getElementById('traffic-chart');

  // Destroy existing chart if it exists
  if (state.charts.traffic) {
    state.charts.traffic.destroy();
  }

  if (data.length === 0) {
    ctx.parentElement.innerHTML = '<p class="empty-state">No traffic data available</p>';
    return;
  }

  state.charts.traffic = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.date),
      datasets: [
        {
          label: 'Pageviews',
          data: data.map(d => d.pageviews),
          borderColor: '#4a9eff',
          backgroundColor: 'rgba(74, 158, 255, 0.1)',
          tension: 0.4
        },
        {
          label: 'Sessions',
          data: data.map(d => d.sessions),
          borderColor: '#34a853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#e8eaed' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#9aa0a6' },
          grid: { color: '#3c4043' }
        },
        x: {
          ticks: { color: '#9aa0a6' },
          grid: { color: '#3c4043' }
        }
      }
    }
  });
}

// Render device chart
function renderDeviceChart(data) {
  const ctx = document.getElementById('device-chart');

  // Destroy existing chart if it exists
  if (state.charts.device) {
    state.charts.device.destroy();
  }

  const total = data.mobile + data.desktop + data.tablet + data.unknown;

  if (total === 0) {
    ctx.parentElement.innerHTML = '<p class="empty-state">No device data available</p>';
    return;
  }

  state.charts.device = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Mobile', 'Desktop', 'Tablet', 'Unknown'],
      datasets: [{
        data: [data.mobile, data.desktop, data.tablet, data.unknown],
        backgroundColor: ['#4a9eff', '#34a853', '#fbbc04', '#ea4335']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#e8eaed' }
        }
      }
    }
  });
}

// Render stations chart
function renderStationsChart(data) {
  const ctx = document.getElementById('stations-chart');

  // Destroy existing chart if it exists
  if (state.charts.stations) {
    state.charts.stations.destroy();
  }

  if (data.length === 0) {
    ctx.parentElement.innerHTML = '<p class="empty-state">No station data available</p>';
    return;
  }

  state.charts.stations = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(s => s.stationId),
      datasets: [{
        label: 'Views',
        data: data.map(s => s.views),
        backgroundColor: '#4a9eff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#9aa0a6' },
          grid: { color: '#3c4043' }
        },
        x: {
          ticks: { color: '#9aa0a6' },
          grid: { color: '#3c4043' }
        }
      }
    }
  });
}

// Handle logs search
function handleLogsSearch() {
  state.logsSearch = document.getElementById('log-search').value;
  state.logsPage = 1;
  loadRequestLogs();
}

// Handle logs clear
function handleLogsClear() {
  document.getElementById('log-search').value = '';
  state.logsSearch = '';
  state.logsPage = 1;
  loadRequestLogs();
}

// Update pagination
function updatePagination(logsCount) {
  document.getElementById('page-info').textContent = `Page ${state.logsPage}`;
  document.getElementById('prev-page-btn').disabled = state.logsPage === 1;
  document.getElementById('next-page-btn').disabled = logsCount < 100;
}

// Auto-refresh functionality
function startAutoRefresh() {
  if (state.refreshInterval) return;

  state.refreshInterval = setInterval(() => {
    if (state.authenticated) {
      loadTabData(state.currentTab);
    }
  }, 30000); // 30 seconds
}

function stopAutoRefresh() {
  if (state.refreshInterval) {
    clearInterval(state.refreshInterval);
    state.refreshInterval = null;
  }
}

// Update last updated timestamp
function updateLastUpdated() {
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

// Utility functions
function formatDate(dateString) {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // More than 24 hours
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '0m';
}
