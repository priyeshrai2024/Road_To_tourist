"use client";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler, ArcElement } from 'chart.js';
import { Doughnut, Radar, Bar, Scatter, Line, PolarArea } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler, ArcElement);
ChartJS.defaults.color = 'rgba(255, 255, 255, 0.2)';
ChartJS.defaults.font.family = 'monospace';

export function VerdictChart({ data }: { data: Record<string, number> }) {
  const vColors: Record<string, string> = {
    'OK': '#c5a059',
    'WRONG_ANSWER': '#f85149',
    'TIME_LIMIT_EXCEEDED': 'rgba(255, 255, 255, 0.35)',
    'MEMORY_LIMIT_EXCEEDED': 'rgba(255, 255, 255, 0.22)',
    'RUNTIME_ERROR': 'rgba(255, 255, 255, 0.15)',
    'COMPILATION_ERROR': 'rgba(255, 255, 255, 0.08)',
    'SKIPPED': 'rgba(255, 255, 255, 0.05)'
  };
  const labels = Object.keys(data);
  return (
    <Doughnut
      data={{
        labels,
        datasets: [{
          data: labels.map(l => data[l]),
          backgroundColor: labels.map(l => vColors[l] || 'rgba(255,255,255,0.05)'),
          borderWidth: 0
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 8,
              color: 'rgba(255, 255, 255, 0.3)',
              font: { family: 'monospace', size: 10 },
              padding: 12
            }
          }
        }
      }}
    />
  );
}

export function TagsRadarChart({ data, handle }: { data: Record<string, number>, handle: string }) {
  const labels = Object.keys(data).sort((a, b) => data[b] - data[a]).slice(0, 15);
  return (
    <Radar
      data={{
        labels,
        datasets: [{
          label: handle,
          data: labels.map(l => data[l]),
          backgroundColor: 'rgba(197, 160, 89, 0.04)',
          borderColor: 'rgba(197, 160, 89, 0.5)',
          pointBackgroundColor: 'rgba(197, 160, 89, 0.6)',
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 1
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { display: false },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { display: false },
            pointLabels: {
              color: 'rgba(255, 255, 255, 0.2)',
              font: { family: 'monospace', size: 9 }
            }
          }
        },
        plugins: { legend: { display: false } }
      }}
    />
  );
}

export function TacticalBarChart({ data, color, horizontal = false }: { data: Record<string, number>, color: string, horizontal?: boolean }) {
  const labels = Object.keys(data)
    .sort((a, b) => horizontal ? data[b] - data[a] : (a === 'Unrated' ? -1 : Number(a) - Number(b)))
    .slice(0, 25);

  let bgColors: any = color;
  if (!horizontal) {
    bgColors = labels.map(r =>
      r === 'Unrated'    ? 'rgba(255, 255, 255, 0.12)' :
      Number(r) < 1200   ? 'rgba(255, 255, 255, 0.18)' :
      Number(r) < 1600   ? 'rgba(255, 255, 255, 0.28)' :
      Number(r) < 1900   ? 'rgba(197, 160, 89, 0.55)'  :
      Number(r) < 2100   ? 'rgba(197, 160, 89, 0.75)'  :
                           '#c5a059'
    );
  }

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          data: labels.map(l => data[l]),
          backgroundColor: bgColors,
          borderRadius: 2,
          borderWidth: 0
        }]
      }}
      options={{
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: horizontal ? 'rgba(255,255,255,0.03)' : 'transparent' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } },
          y: { grid: { color: horizontal ? 'transparent' : 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } }
        }
      }}
    />
  );
}

export function TimeToSolveChart({ data }: { data: Record<string, number> }) {
  const labels = Object.keys(data);
  return (
    <Bar
      data={{
        labels,
        datasets: [{
          data: labels.map(l => data[l]),
          backgroundColor: [
            '#c5a059',
            'rgba(197, 160, 89, 0.6)',
            'rgba(248, 81, 73, 0.5)',
            '#f85149'
          ],
          borderRadius: 2,
          borderWidth: 0
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 10 } }, border: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } }
        }
      }}
    />
  );
}

export function StressBarChart({ data, type }: { data: Record<string, number>, type: 'time' | 'memory' }) {
  const labels = Object.keys(data).sort((a, b) => data[b] - data[a]).slice(0, 10);
  const values = labels.map(l => data[l]);
  const bgColors = values.map(v =>
    type === 'time'
      ? (v >= 1000 ? '#f85149'                      : v >= 500 ? 'rgba(248, 81, 73, 0.45)'  : 'rgba(255, 255, 255, 0.15)')
      : (v >= 128  ? '#f85149'                      : v >= 64  ? 'rgba(248, 81, 73, 0.45)'  : 'rgba(255, 255, 255, 0.15)')
  );

  return (
    <Bar
      data={{
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderRadius: 2,
          borderWidth: 0
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } }, border: { display: false } }
        }
      }}
    />
  );
}

export function ResourceScatterChart({ subs }: { subs: any[] }) {
  const dataPts = subs
    .filter(s => s.verdict === 'OK' && s.timeConsumedMillis > 0)
    .map(s => ({
      x: s.timeConsumedMillis,
      y: s.memoryConsumedBytes / 1048576,
      backgroundColor: s.timeConsumedMillis > 800 ? 'rgba(248, 81, 73, 0.6)' : 'rgba(255, 255, 255, 0.2)'
    }));

  return (
    <Scatter
      data={{
        datasets: [{
          label: 'Accepted',
          data: dataPts,
          pointBackgroundColor: dataPts.map(d => d.backgroundColor),
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            title: { display: true, text: 'Time (ms)', color: 'rgba(255,255,255,0.15)', font: { family: 'monospace', size: 9 } },
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } },
            border: { display: false }
          },
          y: {
            title: { display: true, text: 'Memory (MB)', color: 'rgba(255,255,255,0.15)', font: { family: 'monospace', size: 9 } },
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } },
            border: { display: false }
          }
        }
      }}
    />
  );
}

export function RatingLineChart({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;
  return (
    <Line
      data={{
        labels: history.map(r => {
          const d = new Date(r.ratingUpdateTimeSeconds * 1000);
          return `${d.getMonth() + 1}/${d.getFullYear().toString().substr(-2)}`;
        }),
        datasets: [{
          label: 'Rating',
          data: history.map(r => r.newRating),
          borderColor: 'rgba(197, 160, 89, 0.7)',
          backgroundColor: 'rgba(197, 160, 89, 0.03)',
          borderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#c5a059',
          fill: true,
          tension: 0.3
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: { color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 10, color: 'rgba(255,255,255,0.2)', font: { family: 'monospace', size: 9 } },
            border: { display: false }
          }
        }
      }}
    />
  );
}

export function ActivityHeatmap({ subs }: { subs: any[] }) {
  const counts: Record<string, number> = {};
  const today = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  subs.forEach(s => {
    if (s.verdict === 'OK') {
      const d = new Date(s.creationTimeSeconds * 1000);
      if (d >= sixMonthsAgo) counts[d.toDateString()] = (counts[d.toDateString()] || 0) + 1;
    }
  });

  const cols = [];
  let iterDate = new Date(sixMonthsAgo);

  while (iterDate <= today) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      if (iterDate > today) break;
      const count = counts[iterDate.toDateString()] || 0;
      let bg =
        count === 0 ? 'bg-white/[0.03]'  :
        count === 1 ? 'bg-white/[0.08]'  :
        count === 2 ? 'bg-white/[0.14]'  :
        count === 3 ? 'bg-[rgba(197,160,89,0.35)]' :
        count === 4 ? 'bg-[rgba(197,160,89,0.55)]' :
                      'bg-[#c5a059]';
      col.push(
        <div
          key={iterDate.toDateString()}
          className={`w-3 h-3 ${bg}`}
          title={`${iterDate.toDateString()}: ${count} solves`}
        />
      );
      iterDate.setDate(iterDate.getDate() + 1);
    }
    cols.push(<div key={cols.length} className="flex flex-col gap-[3px]">{col}</div>);
  }

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-2 h-full items-center">
      {cols}
    </div>
  );
}

export function ChronotypeChart({ subs }: { subs: any[] }) {
  const hourCounts = new Array(24).fill(0);

  subs.forEach(s => {
    if (s.verdict === 'OK') {
      const date = new Date(s.creationTimeSeconds * 1000);
      hourCounts[date.getHours()]++;
    }
  });

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  return (
    <PolarArea
      data={{
        labels,
        datasets: [{
          data: hourCounts,
          backgroundColor: hourCounts.map(count =>
            count >= 10 ? 'rgba(248, 81, 73, 0.55)'   :
            count >= 4  ? 'rgba(197, 160, 89, 0.35)'  :
                          'rgba(255, 255, 255, 0.05)'
          ),
          borderColor: 'rgba(255, 255, 255, 0.04)',
          borderWidth: 1
        }]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { display: false },
            angleLines: { display: false },
            pointLabels: {
              display: true,
              color: 'rgba(255, 255, 255, 0.18)',
              font: { family: 'monospace', size: 9 }
            }
          }
        },
        plugins: { legend: { display: false } }
      }}
    />
  );
}
