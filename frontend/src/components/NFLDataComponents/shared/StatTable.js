import React from 'react';
import { tableStyle, thStyle, tdStyle, nameCellStyle, totalRowStyle, messageStyle } from './tableStyles';

// Generic stat table.
// columns: [{ key, label, width?, align?, render?(row) , sortable? }]
// sort: { key, direction } and onSort(key) enable clickable headers.
const StatTable = ({
  columns,
  rows,
  totals,
  emptyMessage = 'No data',
  sort,
  onSort,
  minWidth,
  totalsLabel = 'Team',
  rowKey = (r, i) => r.id ?? i,
}) => {
  if (!rows || rows.length === 0) {
    return <div style={messageStyle}>{emptyMessage}</div>;
  }

  const cellValue = (column, row) => {
    const v = column.render ? column.render(row) : row[column.key];
    return v === null || v === undefined || v === '' ? '—' : v;
  };

  return (
    <div className="stat-table-scroll" style={{ overflowX: 'auto' }}>
      <table style={minWidth ? { ...tableStyle, minWidth } : tableStyle}>
        <thead>
          <tr>
            {columns.map((column, i) => {
              const isSorted = sort?.key === column.key;
              const sortable = onSort && column.sortable !== false;
              return (
                <th
                  key={column.key}
                  onClick={sortable ? () => onSort(column.key) : undefined}
                  style={{
                    ...thStyle,
                    width: column.width,
                    textAlign: i === 0 ? 'left' : column.align || 'center',
                    paddingLeft: i === 0 ? '8px' : thStyle.padding,
                    cursor: sortable ? 'pointer' : 'default',
                  }}
                >
                  {column.label}
                  {isSorted && (
                    <span style={{ fontSize: '0.5rem', marginLeft: '2px' }}>
                      {sort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const last = rowIndex === rows.length - 1 && !totals;
            return (
              <tr key={rowKey(row, rowIndex)}>
                {columns.map((column, i) => (
                  <td
                    key={column.key}
                    title={i === 0 ? String(cellValue(column, row)) : undefined}
                    style={{
                      ...(i === 0 ? nameCellStyle : tdStyle),
                      textAlign: i === 0 ? 'left' : column.align || 'center',
                      borderBottom: last ? 'none' : tdStyle.borderBottom,
                    }}
                  >
                    {cellValue(column, row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {totals && (
            <tr style={totalRowStyle}>
              {columns.map((column, i) => (
                <td
                  key={column.key}
                  style={{
                    ...(i === 0 ? nameCellStyle : tdStyle),
                    fontWeight: 700,
                    borderBottom: 'none',
                  }}
                >
                  {i === 0 ? totalsLabel : totals[column.key] ?? ''}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StatTable;
