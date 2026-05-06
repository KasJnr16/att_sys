import React from 'react';

interface TableProps {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  className?: string;
  stickyHeader?: boolean;
  emptyMessage?: string;
}

export const Table: React.FC<TableProps> = ({
  headers,
  rows,
  className = '',
  stickyHeader = true,
  emptyMessage = 'No data available',
}) => {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className={`bg-slate-50 text-xs font-semibold uppercase text-slate-600 tracking-wide ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {headers.map((header, index) => (
                <th key={index} className="px-4 py-3 border-b border-slate-200 first:pl-5 last:pr-5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                if (row.length === 1 && React.isValidElement(row[0])) {
                  const element = row[0] as React.ReactElement;
                  if (element.type !== React.Fragment) {
                    return React.cloneElement(element, { key: rowIndex });
                  }
                }

                return (
                  <tr key={rowIndex} className="hover:bg-slate-50/80 transition-colors">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3.5 whitespace-nowrap first:pl-5 last:pr-5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const MergedRow: React.FC<{ children: React.ReactNode; colSpan: number; className?: string }> = ({
  children,
  colSpan,
  className = '',
}) => (
  <tr className={`bg-indigo-50/50 font-semibold ${className}`}>
    <td colSpan={colSpan} className="px-6 py-2 text-indigo-900 first:pl-5 last:pr-5">
      {children}
    </td>
  </tr>
);
