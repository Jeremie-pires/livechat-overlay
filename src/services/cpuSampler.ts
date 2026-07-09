import os from 'os';

interface Snapshot {
  idle: number;
  total: number;
}

const getSnapshot = (): Snapshot => {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }
  return { idle, total };
};

let prev = getSnapshot();
let cpuPercent = 0;

setInterval(() => {
  const curr = getSnapshot();
  const idleDiff = curr.idle - prev.idle;
  const totalDiff = curr.total - prev.total;
  cpuPercent = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 1000) / 10 : 0;
  prev = curr;
}, 2000);

export const getCpuPercent = () => cpuPercent;
