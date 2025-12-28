// Tide curve chart using Chart.js
// Based on fishing_bot4.py sparkline concept but using Chart.js for better visualization

import { formatTime } from '../utils/datetime.js';

let currentChart = null; // Store current chart instance to destroy before creating new one

/**
 * Render 24-hour tide curve chart with observed and predicted data
 * @param {Object} curveData - Object with predicted, observed (optional), and nowIndex
 */
export function renderTideChart(curveData) {
  if (!curveData || !curveData.predicted || !curveData.predicted.times || !curveData.predicted.heights) {
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

  // Build a time-to-index map for proper x-axis positioning
  const timeMap = new Map();

  // Collect observed times (if available)
  if (curveData.observed && curveData.observed.times && curveData.observed.times.length > 0) {
    curveData.observed.times.forEach(time => {
      timeMap.set(time.getTime(), time);
    });
  }

  // Collect predicted times
  curveData.predicted.times.forEach(time => {
    timeMap.set(time.getTime(), time);
  });

  // Sort times chronologically
  const sortedTimes = Array.from(timeMap.values()).sort((a, b) => a - b);
  const labels = sortedTimes.map(time => formatTime(time));

  // Create index lookup map
  const timeToIndexMap = new Map();
  sortedTimes.forEach((time, index) => {
    timeToIndexMap.set(time.getTime(), index);
  });

  // Build observed data using correct indices
  const observedData = [];
  if (curveData.observed && curveData.observed.times && curveData.observed.times.length > 0) {
    curveData.observed.times.forEach((time, idx) => {
      const xIndex = timeToIndexMap.get(time.getTime());
      if (xIndex !== undefined) {
        observedData.push({ x: labels[xIndex], y: curveData.observed.heights[idx] });
      }
    });
  }

  // Build predicted data using correct indices
  const predictedData = [];
  curveData.predicted.times.forEach((time, idx) => {
    const xIndex = timeToIndexMap.get(time.getTime());
    if (xIndex !== undefined) {
      predictedData.push({ x: labels[xIndex], y: curveData.predicted.heights[idx] });
    }
  });

  // Find "Now" time label
  const now = new Date();
  let nowLabel = null;
  let minDiff = Infinity;
  sortedTimes.forEach(time => {
    const diff = Math.abs(time - now);
    if (diff < minDiff) {
      minDiff = diff;
      nowLabel = formatTime(time);
    }
  });

  // Build datasets array
  const datasets = [];

  // Dataset 1: Predicted water level (blue)
  datasets.push({
    label: 'Predicted Water Level',
    data: predictedData,
    borderColor: '#4A90E2',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    tension: 0.4,
    pointRadius: 0,
    borderWidth: 2,
    fill: true,
    order: 2 // Draw behind observed
  });

  // Dataset 2: Observed water level (red) - only if available
  if (curveData.observed && observedData.length > 0) {
    datasets.push({
      label: 'Observed Water Level',
      data: observedData,
      borderColor: '#E24A4A',
      backgroundColor: 'transparent',
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
      fill: false,
      order: 1 // Draw on top of predicted
    });
  }

  // Build chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 20,
          boxHeight: 2,
          padding: 10,
          font: {
            size: 11
          },
          color: '#333',
          generateLabels: (chart) => {
            return [
              {
                text: 'Predicted Water Level',
                fillStyle: '#4A90E2',
                strokeStyle: '#4A90E2',
                lineWidth: 2,
                hidden: false
              },
              {
                text: curveData.observed && observedData.length > 0
                  ? 'Observed Water Level'
                  : 'Observed Water Level (not available)',
                fillStyle: curveData.observed && observedData.length > 0 ? '#E24A4A' : '#999',
                strokeStyle: curveData.observed && observedData.length > 0 ? '#E24A4A' : '#999',
                lineWidth: 2,
                hidden: false,
                fontStyle: curveData.observed && observedData.length > 0 ? 'normal' : 'italic'
              }
            ];
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (context) => {
            return context[0].label;
          },
          label: (context) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ft`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'category',
        labels: labels,
        grid: {
          color: '#e0e0e0',
          drawBorder: true
        },
        ticks: {
          color: '#666',
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 12,
          font: {
            size: 10
          }
        }
      },
      y: {
        grid: {
          color: (context) => {
            return context.tick.value === 0 ? '#666' : '#e0e0e0';
          },
          lineWidth: (context) => {
            return context.tick.value === 0 ? 2 : 1;
          },
          drawBorder: true
        },
        ticks: {
          color: '#666',
          stepSize: 0.5,
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
        beginAtZero: false,
        grace: '5%'
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  // Add annotation plugin for "Now" marker
  const annotationPlugin = window.ChartAnnotation || window.chartjsPluginAnnotation;

  if (annotationPlugin && nowLabel) {
    try {
      if (!Chart.registry.plugins.get('annotation')) {
        Chart.register(annotationPlugin);
      }
    } catch (e) {
      console.log('Annotation plugin already registered');
    }

    chartOptions.plugins.annotation = {
      annotations: {
        nowLine: {
          type: 'line',
          xMin: nowLabel,
          xMax: nowLabel,
          borderColor: '#333',
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            content: 'Now',
            display: true,
            position: 'start',
            backgroundColor: '#333',
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
    console.log('Added "Now" marker at label:', nowLabel);
  }

  // Create the chart
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: datasets
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
