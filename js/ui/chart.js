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
 * Render 7-day weekly tide forecast chart
 * @param {Array} predictions7Day - Array of {time, ft} prediction objects for 7 days
 */
export function renderWeeklyTideChart(predictions7Day) {
  if (!predictions7Day || predictions7Day.length === 0) {
    console.warn('No 7-day prediction data available');
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
  const tideData = predictions7Day.map(pred => ({
    x: pred.time,
    y: pred.ft
  }));

  // Calculate exact date boundaries (midnight today to midnight +7 days)
  const now = new Date();
  const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const midnightEnd = new Date(midnightToday);
  midnightEnd.setDate(midnightEnd.getDate() + 7);

  // Create day boundary annotations for vertical lines
  const dayBoundaries = [];
  const noonMarkers = [];

  // Create vertical lines at midnight for each day (day separators)
  // Start from day 1 (skip day 0 since that's the left edge)
  for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
    const dayBoundary = new Date(midnightToday);
    dayBoundary.setDate(midnightToday.getDate() + dayOffset);

    dayBoundaries.push({
      type: 'line',
      xMin: dayBoundary,
      xMax: dayBoundary,
      borderColor: 'rgba(0, 0, 0, 0.15)',
      borderWidth: 1,
      borderDash: [3, 3]
    });
  }

  // Create transparent dashed lines at noon for each day
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const noonTime = new Date(midnightToday);
    noonTime.setDate(midnightToday.getDate() + dayOffset);
    noonTime.setHours(12, 0, 0, 0); // Set to 12:00 PM

    noonMarkers.push({
      type: 'line',
      xMin: noonTime,
      xMax: noonTime,
      borderColor: 'rgba(0, 0, 0, 0.06)', // More transparent
      borderWidth: 1,
      borderDash: [2, 4] // Different dash pattern
    });
  }

  // Measure CSS column widths first, then size chart to match
  // This ensures perfect alignment by making CSS the source of truth
  const dateCell = document.querySelector('.forecast-date-cell');

  if (!dateCell) {
    console.warn('Could not find forecast date cell for measurement, using default width');
    canvas.width = 635;
    canvas.height = 220;
  } else {
    // Measure actual rendered column width
    const cellRect = dateCell.getBoundingClientRect();
    const columnWidth = cellRect.width;

    // Measure gap between columns (from CSS grid gap)
    const tableRow = document.querySelector('.forecast-table-row');
    const computedStyle = window.getComputedStyle(tableRow);
    const gapValue = computedStyle.columnGap || computedStyle.gridColumnGap || '4px';
    const gap = parseFloat(gapValue);

    // Calculate total chart width: 7 columns + 6 gaps
    const chartContainerWidth = (7 * columnWidth) + (6 * gap);

    // Get container padding
    const chartContainer = document.querySelector('.forecast-chart-container');
    const containerStyle = window.getComputedStyle(chartContainer);
    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 8;
    const paddingRight = parseFloat(containerStyle.paddingRight) || 8;

    // Calculate canvas width (container width minus padding)
    const canvasWidth = Math.round(chartContainerWidth - paddingLeft - paddingRight);

    canvas.width = canvasWidth;
    canvas.height = 220;

    console.log(`CSS-first measurement: columnWidth=${columnWidth}px, gap=${gap}px, chartWidth=${canvasWidth}px`);
  }

  // Build chart options with responsive disabled for fixed sizing
  const chartOptions = {
    responsive: false,
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
        min: midnightToday.getTime(),
        max: midnightEnd.getTime(),
        time: {
          unit: 'day',
          displayFormats: {
            day: 'EEE M/d'
          },
          tooltipFormat: 'EEE MMM d, h:mm a'
        },
        grid: {
          color: '#e0e0e0',
          drawBorder: true
        },
        ticks: {
          color: '#666',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: {
            size: 10,
            weight: 'bold'
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

  // Expose chart to console for interactive debugging
  window.forecastTideChart = currentForecastTideChart;

  console.log(`7-day forecast tide chart rendered with ${tideData.length} data points`);
  console.log('🔧 Chart exposed as window.forecastTideChart - Use these commands to tinker:');
  console.log('  • Adjust width: forecastTideChart.canvas.width = 780; forecastTideChart.update();');
  console.log('  • Adjust x-axis max: forecastTideChart.options.scales.x.max = Date.now() + (7*24*60*60*1000); forecastTideChart.update();');
  console.log('  • View current settings: forecastTideChart.options.scales.x');
}

/**
 * Render mini tide sparkline for a single day (24 hours, midnight to midnight)
 * @param {number} dayIndex - Day index (0-6)
 * @param {Array} predictions7Day - Full 7-day prediction array
 */
export function renderDayTideSparkline(dayIndex, predictions7Day) {
  if (!predictions7Day || predictions7Day.length === 0) {
    console.warn(`No predictions available for day ${dayIndex}`);
    return;
  }

  const canvas = document.getElementById(`day-tide-chart-${dayIndex}`);
  if (!canvas) {
    console.warn(`Canvas for day ${dayIndex} not found`);
    return;
  }

  const ctx = canvas.getContext('2d');

  // Explicitly set canvas dimensions to prevent Chart.js from scaling them
  canvas.width = 120;
  canvas.height = 60;

  // Calculate midnight boundaries for this specific day
  const now = new Date();
  const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayStart = new Date(midnightToday);
  dayStart.setDate(midnightToday.getDate() + dayIndex);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  // Filter predictions for just this day
  const dayPredictions = predictions7Day.filter(pred => {
    const predTime = pred.time;
    return predTime >= dayStart && predTime < dayEnd;
  });

  if (dayPredictions.length === 0) {
    console.warn(`No predictions found for day ${dayIndex}`);
    return;
  }

  // Build dataset
  const tideData = dayPredictions.map(pred => ({
    x: pred.time,
    y: pred.ft
  }));

  // Calculate y-axis range with padding to prevent curve overflow
  const yValues = tideData.map(d => d.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY;
  const yPadding = yRange * 0.15; // 15% padding top and bottom

  // Use first and last data points for x-axis bounds instead of exact midnight
  // This ensures the curve starts at the left edge and ends at the right edge
  const xMin = tideData[0].x;
  const xMax = tideData[tideData.length - 1].x;

  console.log(`Day ${dayIndex} sparkline: ${tideData.length} points, xMin=${new Date(xMin).toLocaleString()}, xMax=${new Date(xMax).toLocaleString()}`);

  // Minimal sparkline options - no axes, no legend, just the curve
  const chartOptions = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: 'nearest',
        intersect: false,
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
          },
          label: (context) => {
            return `${context.parsed.y.toFixed(2)} ft`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        display: false, // Hide x-axis
        offset: false, // Prevent automatic offset
        bounds: 'data', // Use data boundaries, not tick boundaries
        min: xMin,
        max: xMax,
        ticks: {
          source: 'data' // Use only data points for ticks
        },
        time: {
          tooltipFormat: 'MMM d, h:mm a'
        }
      },
      y: {
        display: false, // Hide y-axis
        grid: { display: false },
        min: minY - yPadding,
        max: maxY + yPadding
      }
    }
  };

  // Create the sparkline chart
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        data: tideData,
        borderColor: '#4A90E2',
        backgroundColor: 'rgba(74, 144, 226, 0.1)',
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 1.5,
        fill: true
      }]
    },
    options: chartOptions
  });
}
