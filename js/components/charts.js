// Interactive SVG Charting Engine for Clinch Admin Portal
(function () {
  window.ClinchCharts = {
    renderBarChart(containerId, data, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const height = options.height || 220;
      const width = container.clientWidth || 500;
      const padding = { top: 25, right: 20, bottom: 35, left: 55 };
      
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const maxValue = Math.max(...data.map(d => d.value)) * 1.15;
      const barWidth = Math.min(46, (chartWidth / data.length) * 0.55);
      const step = chartWidth / data.length;

      // Primary colors based on theme
      const primaryColor = isDark ? '#0ea5e9' : '#0284c7';
      const secondaryColor = isDark ? '#06b6d4' : '#0891b2';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
      const textColor = isDark ? '#94a3b8' : '#64748b';

      let svgHtml = `
        <svg class="svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
          <defs>
            <linearGradient id="barGrad-${containerId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.9" />
              <stop offset="100%" stop-color="${secondaryColor}" stop-opacity="0.6" />
            </linearGradient>
            <filter id="barGlow-${containerId}" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
      `;

      // Horizontal Grid lines (4 intervals)
      for (let i = 0; i <= 4; i++) {
        const yVal = (maxValue / 4) * i;
        const yPos = padding.top + chartHeight - (chartHeight * (yVal / maxValue));
        svgHtml += `
          <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="${gridColor}" stroke-dasharray="3 3" />
          <text x="${padding.left - 10}" y="${yPos + 4}" text-anchor="end" font-size="11" fill="${textColor}" font-family="var(--font-sans)">
            ${options.prefix || ''}${formatNumber(yVal)}
          </text>
        `;
      }

      // Render Bars & Labels
      data.forEach((d, index) => {
        const x = padding.left + (index * step) + (step - barWidth) / 2;
        const barH = (d.value / maxValue) * chartHeight;
        const y = padding.top + chartHeight - barH;

        svgHtml += `
          <g class="chart-bar-group" data-label="${d.label}" data-val="${options.prefix || ''}${formatNumber(d.value)}">
            <rect 
              x="${x}" 
              y="${y}" 
              width="${barWidth}" 
              height="${barH}" 
              rx="5" 
              ry="5" 
              fill="url(#barGrad-${containerId})" 
              filter="url(#barGlow-${containerId})"
              style="transition: all 0.25s ease; cursor: pointer;"
              onmouseenter="this.setAttribute('opacity', '0.75');"
              onmouseleave="this.setAttribute('opacity', '1');"
            >
              <title>${d.label}: ${options.prefix || ''}${formatNumber(d.value)}</title>
            </rect>
            <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="${primaryColor}">
              ${options.prefix || ''}${formatNumber(d.value)}
            </text>
            <text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" font-size="11" font-weight="500" fill="${textColor}" font-family="var(--font-sans)">
              ${d.label}
            </text>
          </g>
        `;
      });

      svgHtml += `</svg>`;
      container.innerHTML = svgHtml;
    },

    renderLineChart(containerId, data, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';

      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const height = options.height || 220;
      const width = container.clientWidth || 500;
      const padding = { top: 25, right: 25, bottom: 35, left: 50 };

      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const maxValue = Math.max(...data.map(d => d.value)) * 1.25;
      const minValue = 0;
      const step = chartWidth / (data.length - 1);

      const lineColor = options.color || (isDark ? '#38bdf8' : '#0284c7');
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';
      const textColor = isDark ? '#94a3b8' : '#64748b';

      const points = data.map((d, i) => {
        const x = padding.left + (i * step);
        const y = padding.top + chartHeight - ((d.value / maxValue) * chartHeight);
        return { x, y, value: d.value, label: d.label };
      });

      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        // smooth curve via cubic bezier
        const prev = points[i - 1];
        const curr = points[i];
        const cpX1 = prev.x + (curr.x - prev.x) / 2;
        const cpY1 = prev.y;
        const cpX2 = prev.x + (curr.x - prev.x) / 2;
        const cpY2 = curr.y;
        pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
      }

      const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

      let svgHtml = `
        <svg class="svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
          <defs>
            <linearGradient id="lineGrad-${containerId}" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.3" />
              <stop offset="100%" stop-color="${lineColor}" stop-opacity="0.0" />
            </linearGradient>
          </defs>
      `;

      // Grid lines (3 intervals)
      for (let i = 0; i <= 3; i++) {
        const yVal = (maxValue / 3) * i;
        const yPos = padding.top + chartHeight - (chartHeight * (yVal / maxValue));
        svgHtml += `
          <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="${gridColor}" stroke-dasharray="3 3" />
          <text x="${padding.left - 8}" y="${yPos + 4}" text-anchor="end" font-size="11" fill="${textColor}" font-family="var(--font-sans)">
            ${yVal.toFixed(1)}${options.suffix || ''}
          </text>
        `;
      }

      // Gradient Area fill
      svgHtml += `<path d="${areaD}" fill="url(#lineGrad-${containerId})" />`;
      // Main Line stroke
      svgHtml += `<path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;

      // Data Points & Labels
      points.forEach(p => {
        svgHtml += `
          <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${isDark ? '#0c121e' : '#ffffff'}" stroke="${lineColor}" stroke-width="2.5" style="cursor: pointer;">
            <title>${p.label}: ${p.value}${options.suffix || ''}</title>
          </circle>
          <text x="${p.x}" y="${p.y - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="${lineColor}">
            ${p.value}${options.suffix || ''}
          </text>
          <text x="${p.x}" y="${height - 10}" text-anchor="middle" font-size="11" fill="${textColor}" font-family="var(--font-sans)">
            ${p.label}
          </text>
        `;
      });

      svgHtml += `</svg>`;
      container.innerHTML = svgHtml;
    }
  };

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
    return Math.round(num);
  }

  // Auto redraw on window resize or theme switch
  window.addEventListener('resize', debounceRedraw);
  window.addEventListener('clinch-theme-changed', debounceRedraw);

  let resizeTimer = null;
  function debounceRedraw() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('clinch-redraw-charts'));
    }, 150);
  }
})();
