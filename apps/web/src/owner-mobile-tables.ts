/** Preserves column context when wide admin tables are displayed as mobile records. */
export function labelMobileTableCells(table:HTMLTableElement|null|undefined){
  if(!table)return;
  const labels=Array.from(table.tHead?.rows[0]?.cells||[],cell=>cell.textContent?.trim()||'Ações');
  for(const row of Array.from(table.tBodies[0]?.rows||[])){
    let column=0;
    for(const cell of Array.from(row.cells)){
      if(cell.colSpan>1){cell.removeAttribute('data-label');column+=cell.colSpan;continue}
      cell.dataset.label=labels[column]||'Ações';
      column++;
    }
  }
}
