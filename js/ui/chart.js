// Tide curve chart using Chart.js
// Based on fishing_bot4.py sparkline concept but using Chart.js for better visualization

import { formatTime } from '../utils/datetime.js';

let currentChart = null; // Store current chart instance to destroy before creating new one

/**
 * Render 24-hour tide curve chart
 * @param {Object} curveData - Object with times, heights, and nowIndex
 */
export function renderTideChart(curveData) {
  if (!curveData || !curveData.times || !curveData.heights) {
    console.warn('Invalid curve data for chart');
    return;
  }

  const canvas = document.getElementById('tide-chart');
  if (!canvas) {
    console.warn('Canvas element not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroy previous chart if exists
  if (currentChart) {
    currentChart.destroy();
  }

  // Prepare all labels - we need all of them for the annotation plugin to work
  const labels = curveData.times.map((time, idx) => formatTime(time));

  // Build chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex;
            return formatTime(curveData.times[index]);
          },
          label: (context) => {
            return `${context.parsed.y.toFixed(2)} ft`;
          }
        }
      }
    },
    scales: {
        x: {
          grid: {
            color: '#e0e0e0',
            drawBorder: true
          },
          ticks: {
            color: '#666',
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 12,  // Show approximately every 2 hours
            font: {
              size: 10
            }
          }
        },
        y: {
          grid: {
            color: (context) => {
              // Highlight the zero line
              return context.tick.value === 0 ? '#666' : '#e0e0e0';
            },
            lineWidth: (context) => {
              // Make zero line thicker
              return context.tick.value === 0 ? 2 : 1;
            },
            drawBorder: true
          },
          ticks: {
            color: '#666',
            stepSize: 0.5,  // Regular increments of 0.5 ft
            callback: (value) => {
              return value.toFixed(1) + ' ft';
            }
          },
          title: {
            display: true,
            text: 'Height (ft MLLW)',
            color: '#333',
            font: {
              size: 11,
              weight: 'bold'
            }
          },
          // Ensure 0 is always included in the range
          beginAtZero: false,
          grace: '5%'  // Add 5% padding to min/max
        }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  // Add annotation plugin for "Now" marker
  // Check for the annotation plugin in various possible global names
  const annotationPlugin = window.ChartAnnotation || window.chartjsPluginAnnotation;

  if (annotationPlugin && curveData.nowIndex !== undefined) {
    // Register the plugin if it's not already registered
    try {
      if (!Chart.registry.plugins.get('annotation')) {
        Chart.register(annotationPlugin);
      }
    } catch (e) {
      console.log('Annotation plugin already registered or auto-registered');
    }

    // Use the actual label value at the nowIndex
    const nowLabel = labels[curveData.nowIndex];

    chartOptions.plugins.annotation = {
      annotations: {
        nowLine: {
          type: 'line',
          xMin: nowLabel,
          xMax: nowLabel,
          borderColor: '#cc0000',
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            content: 'Now',
            display: true,
            position: 'start',
            backgroundColor: '#cc0000',
            color: '#ffffff',
            font: {
              size: 10,
              weight: 'bold'
            },
            yAdjust: -6
          }
        }
      }
    };
    console.log('Added "Now" marker at index:', curveData.nowIndex, 'label:', nowLabel);
  } else {
    console.warn('Annotation plugin not available or nowIndex missing. Plugin:', !!annotationPlugin, 'nowIndex:', curveData.nowIndex);
  }

  // Create the chart
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tide Height',
        data: curveData.heights,
        borderColor: '#333',
        backgroundColor: 'rgba(100, 100, 100, 0.1)',
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
        fill: true
      }]
    },
    options: chartOptions
  });
}

/**
 * Destroy current chart instance
 */
export function destroyChart() {
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
}
