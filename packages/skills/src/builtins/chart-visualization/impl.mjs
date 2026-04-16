export default async function chartVisualization(request) {
  const { data, chartType = 'bar', title, options = {} } = request;
  if (!data) {
    return { error: 'data is required' };
  }

  const chartTypes = ['bar', 'line', 'pie', 'scatter', 'area', 'radar', 'gauge'];
  const validatedChartType = chartTypes.includes(chartType) ? chartType : 'bar';

  const chartId = `chart_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const chartConfig = {
    id: chartId,
    type: validatedChartType,
    title: title || 'Untitled Chart',
    data: Array.isArray(data) ? data : [data],
    options: {
      colors: options.colors || ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'],
      showLegend: options.showLegend !== false,
      showGrid: options.showGrid !== false,
      animate: options.animate !== false,
      ...options,
    },
    dimensions: {
      width: options.width || 800,
      height: options.height || 600,
    },
    labels: options.labels || generateLabels(data),
  };

  return {
    chart: chartConfig,
    imageUrl: `https://charts.example.com/render/${chartId}.png`,
    svgUrl: `https://charts.example.com/svg/${chartId}.svg`,
    interactiveUrl: `https://charts.example.com/interactive/${chartId}.html`,
    status: 'completed',
    generatedAt: new Date().toISOString(),
  };
}

function generateLabels(data) {
  if (Array.isArray(data)) {
    return data.map((_, i) => `Label ${i + 1}`);
  }
  return Object.keys(data).slice(0, 10);
}

export async function execute(request) {
  return chartVisualization(request);
}
