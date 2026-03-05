"use client";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler, ArcElement } from 'chart.js';
import { Doughnut, Radar, Bar, Scatter, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler, ArcElement);
ChartJS.defaults.color = '#8b949e';
ChartJS.defaults.font.family = 'Inter';

export function VerdictChart({ data }: { data: Record<string, number> }) {
  const vColors: Record<string, string> = { 'OK': '#2ea043', 'WRONG_ANSWER': '#f85149', 'TIME_LIMIT_EXCEEDED': '#e3b341', 'MEMORY_LIMIT_EXCEEDED': '#d2a8ff', 'RUNTIME_ERROR': '#58a6ff', 'COMPILATION_ERROR': '#8b949e', 'SKIPPED': '#484f58' };
  const labels = Object.keys(data);
  return <Doughnut data={{ labels, datasets: [{ data: labels.map(l => data[l]), backgroundColor: labels.map(l => vColors[l] || '#30363d'), borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, color: '#e0e6ed', font: { family: 'JetBrains Mono' } } } } }} />;
}

export function TagsRadarChart({ data, handle }: { data: Record<string, number>, handle: string }) {
  const labels = Object.keys(data).sort((a,b) => data[b] - data[a]).slice(0, 15);
  return <Radar data={{ labels, datasets: [{ label: handle, data: labels.map(l => data[l]), backgroundColor: 'rgba(88, 166, 255, 0.2)', borderColor: '#58a6ff', pointBackgroundColor: '#58a6ff', borderWidth: 2 }] }} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: '#30363d' }, grid: { color: '#30363d' }, ticks: { display: false }, pointLabels: { color: '#8b949e', font: {family: 'JetBrains Mono', size: 9} } } }, plugins: { legend: { display: false } } }} />;
}

export function TacticalBarChart({ data, color, horizontal = false }: { data: Record<string, number>, color: string, horizontal?: boolean }) {
  const labels = Object.keys(data).sort((a,b) => horizontal ? data[b] - data[a] : (a === 'Unrated' ? -1 : Number(a) - Number(b))).slice(0, 25);
  let bgColors: any = color;
  if (!horizontal) bgColors = labels.map(r => r === 'Unrated' ? '#8b949e' : Number(r) < 1200 ? '#58a6ff' : Number(r) < 1600 ? '#56d364' : Number(r) < 1900 ? '#e3b341' : Number(r) < 2100 ? '#d2a8ff' : '#f85149');
  return <Bar data={{ labels, datasets: [{ data: labels.map(l => data[l]), backgroundColor: bgColors, borderRadius: 4 }] }} options={{ indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: horizontal ? '#30363d' : 'transparent' } }, y: { grid: { color: horizontal ? 'transparent' : '#30363d' } } } }} />;
}

export function TimeToSolveChart({ data }: { data: Record<string, number> }) {
  const labels = Object.keys(data);
  return <Bar data={{ labels, datasets: [{ data: labels.map(l => data[l]), backgroundColor: ['#2ea043', '#56d364', '#e3b341', '#f85149'], borderRadius: 4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: {font: {family: 'JetBrains Mono', size: 10}} }, y: { grid: { color: '#30363d' } } } }} />;
}

export function StressBarChart({ data, type }: { data: Record<string, number>, type: 'time' | 'memory' }) {
  const labels = Object.keys(data).sort((a,b) => data[b] - data[a]).slice(0, 10);
  const values = labels.map(l => data[l]);
  const bgColors = values.map(v => type === 'time' ? (v >= 1000 ? '#f85149' : (v >= 500 ? '#db6d28' : '#56d364')) : (v >= 128 ? '#f85149' : (v >= 64 ? '#db6d28' : '#58a6ff')));
  return <Bar data={{ labels, datasets: [{ data: values, backgroundColor: bgColors, borderRadius: 4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: {family: 'JetBrains Mono', size: 9} } }, y: { grid: { color: '#30363d' } } } }} />;
}

export function ResourceScatterChart({ subs }: { subs: any[] }) {
  const dataPts = subs.filter(s => s.verdict === 'OK' && s.timeConsumedMillis > 0).map(s => ({ x: s.timeConsumedMillis, y: s.memoryConsumedBytes / 1048576, backgroundColor: s.timeConsumedMillis > 800 ? '#f85149' : '#56d364' }));
  return <Scatter data={{ datasets: [{ label: 'Accepted', data: dataPts, pointBackgroundColor: dataPts.map(d => d.backgroundColor) }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'Time (ms)' }, grid: { color: '#30363d' } }, y: { title: { display: true, text: 'Memory (MB)' }, grid: { color: '#30363d' } } } }} />;
}

export function RatingLineChart({ history }: { history: any[] }) {
  if (!history || history.length === 0) return null;
  return <Line data={{ labels: history.map(r => { const d = new Date(r.ratingUpdateTimeSeconds * 1000); return `${d.getMonth()+1}/${d.getFullYear().toString().substr(-2)}`; }), datasets: [{ label: 'Rating', data: history.map(r => r.newRating), borderColor: '#e3b341', backgroundColor: 'rgba(227, 179, 65, 0.1)', borderWidth: 2, pointRadius: 2, pointBackgroundColor: '#f85149', fill: true, tension: 0.3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#30363d' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: {family: 'JetBrains Mono'} } } } }} />;
}

export function ActivityHeatmap({ subs }: { subs: any[] }) {
  const counts: Record<string, number> = {};
  const today = new Date(); const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(today.getMonth() - 6);
  subs.forEach(s => { if (s.verdict === 'OK') { const d = new Date(s.creationTimeSeconds * 1000); if (d >= sixMonthsAgo) counts[d.toDateString()] = (counts[d.toDateString()] || 0) + 1; } });
  const cols = []; let iterDate = new Date(sixMonthsAgo);
  while (iterDate <= today) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      if (iterDate > today) break;
      const count = counts[iterDate.toDateString()] || 0;
      let bg = 'bg-[#2b2e33]';
      if (count === 1) bg = 'bg-[#196127]'; else if (count === 2) bg = 'bg-[#238636]'; else if (count === 3) bg = 'bg-[#2ea043]'; else if (count === 4) bg = 'bg-[#39d353]'; else if (count >= 5) bg = 'bg-[#e3b341]';
      col.push(<div key={iterDate.toDateString()} className={`w-3 h-3 rounded-[2px] ${bg}`} title={`${iterDate.toDateString()}: ${count} solves`}></div>);
      iterDate.setDate(iterDate.getDate() + 1);
    }
    cols.push(<div key={cols.length} className="flex flex-col gap-1">{col}</div>);
  }
  return <div className="flex gap-1 overflow-x-auto pb-2 h-full items-center">{cols}</div>;
}