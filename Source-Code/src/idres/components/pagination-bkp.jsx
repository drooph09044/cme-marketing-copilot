const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Pagination({ page, totalPages, pageSize, onPage, onPageSize, total, pageSizeOptions }) {
  const sizes = pageSizeOptions || PAGE_SIZE_OPTIONS

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total != null
          ? `Page ${page} of ${totalPages} (${total.toLocaleString()} total)`
          : `Page ${page} of ${totalPages}`}
      </span>

      {onPageSize && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="pagination-buttons">
        <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>

        <select
          value={page}
          onChange={e => onPage(Number(e.target.value))}
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, padding: '2px 6px', fontSize: 11, minWidth: 80 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <option key={p} value={p}>Page {p}</option>
          ))}
        </select>

        <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}
