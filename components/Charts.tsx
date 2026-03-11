"use client";

import { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler, ArcElement } from 'chart.js';
import { Doughnut, Radar, Bar, Scatter, Line, PolarArea } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend, Filler, ArcElement);
ChartJS.defaults.color = '#8b949e';
ChartJS.defaults.font.family = 'Inter';

export function VerdictChart({ data }: { data: Record<string, number> }) {
  const vColors: Record<string, string> = { 'OK': '#2ea043', 'WRONG_ANSWER': '#f85149', 'TIME_LIMIT_EXCEEDED': '#e3b341', 'MEMORY_LIMIT_EXCEEDED': '#d2a8ff', 'RUNTIME_ERROR': '#58a6ff', 'COMPILATION_ERROR': '#8b949e', 'SKIPPED': '#484f58' };
  const labels = Object.keys(data);
  return <Doughnut data={{ labels, datasets: [{ data: labels.map(l => data[l]), backgroundColor: labels.map(l => vColors[l] || '#30363d'), borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, color: '#e0e6ed', font: { family: 'JetBrains Mono' } } } } }} />;
}

// Re-engineered into a scrollable horizontal bar chart showing ALL tags
export function TagsRadarChart({ data, handle }: { data: Record<string, number>, handle: string }) {
  const labels = Object.keys(data).sort((a,b) => data[b] - data[a]);
  // Calculate dynamic height: 22px per bar, minimum of 300px
  const dynamicHeight = Math.max(300, labels.length * 22);

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar pr-2">
      <div style={{ height: `${dynamicHeight}px`, position: 'relative' }}>
        <Bar 
          data={{ 
            labels, 
            datasets: [{ 
              label: handle, 
              data: labels.map(l => data[l]), 
              backgroundColor: '#e879f9', // Pink mastery color
              borderRadius: 4 
            }] 
          }} 
          options={{ 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
              x: { grid: { color: '#30363d' }, ticks: { font: {family: 'JetBrains Mono', size: 9} } }, 
              y: { grid: { display: false }, ticks: { color: '#c9d1d9', font: {family: 'JetBrains Mono', size: 10} } } 
            } 
          }} 
        />
      </div>
    </div>
  );
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
  const [hovered, setHovered] = useState<{ date: string, count: number, problems: string[], x: number, y: number } | null>(null);

  const dayMap: Record<string, { count: number, problems: string[] }> = {};
  const today = new Date();
  
  // Start exactly 182 days ago (26 weeks / ~6 months)
  const startDate = new Date();
  startDate.setDate(today.getDate() - 182);

  subs.forEach(s => {
    if (s.verdict === 'OK') {
      const d = new Date(s.creationTimeSeconds * 1000);
      if (d >= startDate) {
        const dateStr = d.toDateString();
        if (!dayMap[dateStr]) dayMap[dateStr] = { count: 0, problems: [] };
        dayMap[dateStr].count++;
        if (s.problem && s.problem.name) {
          const pName = s.problem.name;
          if (!dayMap[dateStr].problems.includes(pName)) dayMap[dateStr].problems.push(pName);
        }
      }
    }
  });

  const cols = [];
  let iterDate = new Date(startDate);
  
  // Snap iterDate backward to the nearest Sunday so the columns align perfectly
  while (iterDate.getDay() !== 0) {
    iterDate.setDate(iterDate.getDate() - 1);
  }

  while (iterDate <= today) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(iterDate);
      
      if (currentDate > today || currentDate < startDate) {
        col.push(<div key={`empty-${iterDate.getTime()}-${i}`} className="w-[14px] h-[14px] rounded-[3px] bg-transparent"></div>);
      } else {
        const dateStr = currentDate.toDateString();
        const data = dayMap[dateStr] || { count: 0, problems: [] };
        
        let bg = 'bg-[#1a1a1a]';
        if (data.count === 1) bg = 'bg-[#196127]';
        else if (data.count === 2) bg = 'bg-[#238636]';
        else if (data.count === 3) bg = 'bg-[#2ea043]';
        else if (data.count === 4) bg = 'bg-[#39d353]';
        else if (data.count >= 5) bg = 'bg-[#e3b341]';

        col.push(
          <div
            key={dateStr}
            className={`w-[14px] h-[14px] rounded-[3px] ${bg} cursor-pointer hover:ring-1 hover:ring-offset-1 ring-offset-[#050505] ring-[#58a6ff] transition-all duration-150`}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              let tooltipX = rect.right + 12; 
              if (tooltipX + 280 > window.innerWidth) tooltipX = rect.left - 290;
              setHovered({ date: dateStr, count: data.count, problems: data.problems, x: tooltipX, y: rect.top - 20 });
            }}
            onMouseLeave={() => setHovered(null)}
          ></div>
        );
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }
    cols.push(<div key={cols.length} className="flex flex-col gap-[6px]">{col}</div>);
  }

  return (
    <div className="relative w-full">
      <div className="flex gap-[6px] overflow-x-auto pb-4 pt-2 px-2 items-center custom-scrollbar" style={{ minHeight: '140px' }}>
        {cols}
      </div>

      {hovered && (
        <div className="fixed z-[9999] bg-[#0d1117] border border-[#30363d] rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-none w-max max-w-[280px] animate-in fade-in zoom-in-95 duration-100" style={{ left: Math.max(10, hovered.x), top: Math.max(10, hovered.y) }}>
          <div className="font-mono text-[11px] text-[#8b949e] mb-2 pb-2 border-b border-[#30363d]">
            <strong className="text-[#56d364]">{hovered.count} solves</strong> on {hovered.date}
          </div>
          {hovered.problems.length > 0 ? (
            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-2">
              {hovered.problems.slice(0, 10).map((p, i) => <div key={i} className="font-mono text-[10px] text-[#58a6ff] truncate">• {p}</div>)}
              {hovered.problems.length > 10 && <div className="font-mono text-[9px] text-[#8b949e] italic mt-1 bg-[#1a1a1a] px-2 py-1 rounded inline-block w-fit">+ {hovered.problems.length - 10} more targets destroyed</div>}
            </div>
          ) : <div className="font-mono text-[10px] text-[#8b949e] mt-1 italic">Zero operations recorded.</div>}
        </div>
      )}
    </div>
  );
}

export function ChronotypeChart({ subs }: { subs: any[] }) {
  const hourCounts = new Array(24).fill(0);
  subs.forEach(s => { if (s.verdict === 'OK') hourCounts[new Date(s.creationTimeSeconds * 1000).getHours()]++; });
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  return (
    <PolarArea 
      data={{ labels, datasets: [{ data: hourCounts, backgroundColor: hourCounts.map(count => count >= 10 ? 'rgba(248, 81, 73, 0.7)' : count >= 4 ? 'rgba(227, 179, 65, 0.5)' : 'rgba(88, 166, 255, 0.2)'), borderColor: '#30363d', borderWidth: 1 }] }}
      options={{ responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: '#30363d' }, ticks: { display: false }, angleLines: { color: '#30363d' }, pointLabels: { display: true, color: '#8b949e', font: { family: 'JetBrains Mono', size: 10 } } } }, plugins: { legend: { display: false } } }}
    />
  );
}