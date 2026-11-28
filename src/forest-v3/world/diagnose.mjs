import { validateWorldGeometry } from './index.ts';

const report = validateWorldGeometry();
console.log(JSON.stringify(report, null, 2));
if (report.issues.length) process.exitCode = 1;
