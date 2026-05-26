/**
 * Returns a standard paginated response shape used by all list endpoints.
 *
 * { data, total, page, limit, totalPages, ...extras }
 *
 * @param {Array}  data    - The page of records
 * @param {number} total   - Total matching record count
 * @param {number} page    - Current page (1-based)
 * @param {number} limit   - Page size
 * @param {object} extras  - Any additional top-level fields (e.g. stats)
 */
function paginate(data, total, page, limit, extras = {}) {
    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        ...extras,
    };
}

module.exports = paginate;
