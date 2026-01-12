// Tide curve chart using Chart.js
// Based on fishing_bot4.py sparkline concept but using Chart.js for better visualization

let currentChart = null; // Store current chart instance to destroy before creating new one
let currentWaterTempChart = null; // Store water temp chart instance
let currentForecastTideChart = null; // Store forecast tide chart instance

/**
 * Render 24-hour tide curve chart with observed and predicted data
 * @param {Object} curveData - Object with predicted, observed (optional), nowIndex, and noPredictions flag
 */
export function renderTideChart(curveData) {
  // Handle case where predictions aren't available - show water level only
  const noPredictions = curveData && curveData.noPredictions === true;

  if (!curveData || (!noPredictions && (!curveData.predicted || !curveData.predicted.times || !curveData.predicted.heights))) {
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

  // Build datasets array
  const datasets = [];

  // If predictions are available, build predicted dataset
  let predictedData = [];
  if (!noPredictions && curveData.predicted) {
    predictedData = curveData.predicted.times.map((time, idx) => ({
      x: time,
      y: curveData.predicted.heights[idx]
    }));

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
  }

  // Build observed dataset
  const observedData = [];
  if (curveData.observed && curveData.observed.times && curveData.observed.times.length > 0) {
    curveData.observed.times.forEach((time, idx) => {
      observedData.push({
        x: time,
        y: curveData.observed.heights[idx]
      });
    });

    // Dataset 2: Observed water level (red/blue depending on mode)
    datasets.push({
      label: noPredictions ? 'Water Level' : 'Observed Water Level',
      data: observedData,
      borderColor: noPredictions ? '#4A90E2' : '#E24A4A',
      backgroundColor: noPredictions ? 'rgba(74, 144, 226, 0.1)' : 'transparent',
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
      fill: noPredictions ? true : false,
      order: 1 // Draw on top of predicted
    });
  }

  // Store current time for "Now" marker
  const now = new Date();

  // Build chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !noPredictions, // Hide legend when only showing water level
        position: 'bottom',
        labels: {
          boxWidth: 16,
          boxHeight: 2,
          padding: 8,
          font: {
            size: 10
          },
          color: '#333',
          generateLabels: (chart) => {
            if (noPredictions) {
              return [];
            }
            return [
              {
                text: 'Predicted',
                fillStyle: '#4A90E2',
                strokeStyle: '#4A90E2',
                lineWidth: 2,
                hidden: false
              },
              {
                text: curveData.observed && observedData.length > 0
                  ? 'Observed'
                  : 'Observed (n/a)',
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
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: {
            hour: 'h:mm a'
          },
          tooltipFormat: 'MMM d, h:mm a'
        },
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

  if (annotationPlugin) {
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
          xMin: now,
          xMax: now,
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
  }

  // Create the chart
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: datasets
    },
    options: chartOptions
  });

  // Add disclaimer below chart if no predictions available
  if (noPredictions) {
    const chartContainer = canvas.parentElement;
    let disclaimer = chartContainer.querySelector('.no-predictions-disclaimer');

    if (!disclaimer) {
      disclaimer = document.createElement('p');
      disclaimer.className = 'no-predictions-disclaimer';
      disclaimer.style.cssText = 'font-size: 0.75rem; color: #666; text-align: center; margin-top: 0.5rem; font-style: italic;';
      disclaimer.textContent = 'No NOAA predicted tide available';
      chartContainer.appendChild(disclaimer);
    }
  }
}

/**
 * Render water temperature history chart (NOAA-style)
 * @param {Array} tempHistory - Array of {time, temp} objects
 */
export function renderWaterTempChart(tempHistory) {
  if (!tempHistory || tempHistory.length === 0) {
    console.warn('No water temperature history data available');
    return;
  }

  const canvas = document.getElementById('water-temp-chart');
  if (!canvas) {
    console.warn('Water temp canvas element not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroy previous chart if exists
  if (currentWaterTempChart) {
    currentWaterTempChart.destroy();
  }

  // Build dataset
  const tempData = tempHistory.map(item => ({
    x: item.time,
    y: item.temp
  }));

  // Calculate min/max for Y-axis (round to whole degrees)
  const temps = tempHistory.map(item => item.temp);
  const minTemp = Math.floor(Math.min(...temps)) - 1;
  const maxTemp = Math.ceil(Math.max(...temps)) + 1;

  const now = new Date();

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
            return context[0].label;
          },
          label: (context) => {
            return `${context.parsed.y.toFixed(1)}°F`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: {
            hour: 'h:mm a'
          },
          tooltipFormat: 'MMM d, h:mm a'
        },
        grid: {
          color: '#e0e0e0'
        },
        ticks: {
          color: '#666',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          font: {
            size: 10
          }
        }
      },
      y: {
        min: minTemp,
        max: maxTemp,
        grid: {
          color: '#e0e0e0'
        },
        ticks: {
          color: '#666',
          stepSize: 1,
          callback: (value) => {
            return Math.round(value);
          }
        },
        title: {
          display: true,
          text: 'Degrees (F)',
          color: '#333',
          font: {
            size: 11,
            weight: 'bold'
          }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false
    }
  };

  // Add annotation plugin for "Now" marker
  const annotationPlugin = window.ChartAnnotation || window.chartjsPluginAnnotation;

  if (annotationPlugin) {
    try {
      if (!Chart.registry.plugins.get('annotation')) {
        Chart.register(annotationPlugin);
      }
    } catch (e) {
      // Plugin already registered
    }

    chartOptions.plugins.annotation = {
      annotations: {
        nowLine: {
          type: 'line',
          xMin: now,
          xMax: now,
          borderColor: '#000000',
          borderWidth: 2,
          borderDash: [],
          label: {
            content: 'Now',
            display: false
          }
        }
      }
    };
  }

  // Create the chart
  currentWaterTempChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Water Temperature',
        data: tempData,
        borderColor: '#1976D2',
        backgroundColor: 'transparent',
        tension: 0,
        pointRadius: 2,
        pointBackgroundColor: '#1976D2',
        borderWidth: 2,
        fill: false
      }]
    },
    options: chartOptions
  });

  console.log(`Water temp chart rendered with ${tempData.length} data points`);
}

/**
 * Render 8-day weekly tide forecast chart
 * @param {Array} predictions8Day - Array of {time, ft} prediction objects for 8 days
 */
export function renderWeeklyTideChart(predictions8Day) {
  if (!predictions8Day || predictions8Day.length === 0) {
    console.warn('No 8-day prediction data available');
    return;
  }

  const canvas = document.getElementById('forecast-tide-chart');
  if (!canvas) {
    console.warn('Forecast tide chart canvas element not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroy previous chart if exists
  if (currentForecastTideChart) {
    currentForecastTideChart.destroy();
  }

  // Build dataset from predictions
  const tideData = predictions8Day.map(pred => ({
    x: pred.time,
    y: pred.ft
  }));

  // Create day boundary annotations for vertical lines
  const dayBoundaries = [];
  const noonMarkers = [];
  const startDate = predictions8Day[0].time;
  const endDate = predictions8Day[predictions8Day.length - 1].time;

  // Create vertical lines at midnight for each day (day separators)
  let currentDay = new Date(startDate);
  currentDay.setHours(0, 0, 0, 0);
  currentDay.setDate(currentDay.getDate() + 1); // Start from next day

  while (currentDay < endDate) {
    dayBoundaries.push({
      type: 'line',
      xMin: currentDay,
      xMax: currentDay,
      borderColor: 'rgba(0, 0, 0, 0.15)',
      borderWidth: 1,
      borderDash: [3, 3]
    });

    // Move to next day
    currentDay = new Date(currentDay);
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // Create transparent dashed lines at noon for each day
  let noonDay = new Date(startDate);
  noonDay.setHours(0, 0, 0, 0);

  while (noonDay < endDate) {
    const noonTime = new Date(noonDay);
    noonTime.setHours(12, 0, 0, 0); // Set to 12:00 PM

    if (noonTime > startDate && noonTime < endDate) {
      noonMarkers.push({
        type: 'line',
        xMin: noonTime,
        xMax: noonTime,
        borderColor: 'rgba(0, 0, 0, 0.06)', // More transparent
        borderWidth: 1,
        borderDash: [2, 4] // Different dash pattern
      });
    }

    // Move to next day
    noonDay.setDate(noonDay.getDate() + 1);
  }

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
            const date = new Date(context[0].parsed.x);
            return date.toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
          },
          label: (context) => {
            return `Height: ${context.parsed.y.toFixed(2)} ft`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'EEE M/d'
          },
          tooltipFormat: 'EEE MMM d, h:mm a',
          // Round to start of day for consistent alignment
          round: 'day'
        },
        min: startDate,
        max: endDate,
        grid: {
          color: '#e0e0e0',
          drawBorder: true,
          offset: false
        },
        ticks: {
          color: '#666',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: {
            size: 10,
            weight: 'bold'
          },
          align: 'center',
          source: 'data'
        },
        offset: true // Add padding on both sides
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

  // Add day boundary lines and noon markers using annotation plugin
  const annotationPlugin = window.ChartAnnotation || window.chartjsPluginAnnotation;

  if (annotationPlugin && (dayBoundaries.length > 0 || noonMarkers.length > 0)) {
    try {
      if (!Chart.registry.plugins.get('annotation')) {
        Chart.register(annotationPlugin);
      }
    } catch (e) {
      // Plugin already registered
    }

    const annotations = {};

    // Add day boundaries (midnight lines)
    dayBoundaries.forEach((boundary, idx) => {
      annotations[`dayBoundary${idx}`] = boundary;
    });

    // Add noon markers
    noonMarkers.forEach((marker, idx) => {
      annotations[`noonMarker${idx}`] = marker;
    });

    chartOptions.plugins.annotation = {
      annotations: annotations
    };
  }

  // Create the chart
  currentForecastTideChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Predicted Tide',
        data: tideData,
        borderColor: '#4A90E2',
        backgroundColor: 'rgba(74, 144, 226, 0.1)',
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
        fill: true
      }]
    },
    options: chartOptions
  });

  console.log(`8-day forecast tide chart rendered with ${tideData.length} data points`);
}
