/** Adds column labels for mobile record layout without modifying table data/actions. */
export function labelMobileTableCells(table:HTMLTableElement|null|undefined){
  if(!table)return;
  const labels=Array.from(table.querySelectorAll<HTMLTableCellElement>('thead tr:first-child th'),cell=>cell.textContent?.trim()||'Ações');
  for(const row of table.querySelectorAll<HTMLTableRowElement>('tbody tr')){
    let column=0;
    for(const cell of row.querySelectorAll<HTMLTableCellElement>('td')){
      const span=Number(cell.getAttribute('colspan')||1);
      if(span>1){cell.removeAttribute('data-label');column+=span;continue}
      cell.dataset.label=labels[column]||'Ações';
      column++;
    }
  }
}
