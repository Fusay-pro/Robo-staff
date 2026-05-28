/* eslint-disable @typescript-eslint/no-explicit-any */
// Small CSV-export helper. No deps.
// Usage:
//   downloadCsv('students.csv', students, [
//     { key: 'name', label: 'Name' },
//     { key: 'classes_remaining', label: 'Classes Left' },
//   ]);

export interface CsvColumn<T = any> {
  key: keyof T | string;
  label: string;
  // Optional transform: (row, value) => string for custom rendering
  format?: (row: T, value: any) => string;
}

function escape(v: any): string {
  if (v == null) return '';
  const s = String(v);
  // Quote if contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T = any>(rows: T[], cols: CsvColumn<T>[]): string {
  const header = cols.map(c => escape(c.label)).join(',');
  const lines = rows.map(row =>
    cols.map(c => {
      const raw = (row as any)[c.key];
      const formatted = c.format ? c.format(row, raw) : raw;
      return escape(formatted);
    }).join(',')
  );
  // BOM so Excel detects UTF-8 (important for Thai chars)
  return 'ï»¿' + [header, ...lines].join('\r\n');
}

export function downloadCsv<T = any>(filename: string, rows: T[], cols: CsvColumn<T>[]) {
  const csv = toCsv(rows, cols);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

