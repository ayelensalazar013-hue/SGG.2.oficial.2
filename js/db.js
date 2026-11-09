let db = null;
const NOMBRE_DB = "gastos.sqlite";

// Inicialización de SQLite (WebAssembly) y recuperación desde OPFS
async function inicializarBaseDeDatos() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    const root = await navigator.storage.getDirectory();

    try {
        const fileHandle = await root.getFileHandle(NOMBRE_DB);
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        db = new SQL.Database(new Uint8Array(buffer));
    } catch (error) {
        db = new SQL.Database();
        crearTablasIniciales();
        await guardarEnOPFS();
    }
}

// Estructura de tabla con consultas SQL estándar (CREATE TABLE)
function crearTablasIniciales() {
    if (!db) return;
    const sql = `
        CREATE TABLE IF NOT EXISTS movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            correo_usuario TEXT NOT NULL,
            tipo_movimiento TEXT CHECK(tipo_movimiento IN ('ingreso', 'egreso')) NOT NULL,
            monto REAL NOT NULL,
            fecha TEXT NOT NULL,
            categoria TEXT NOT NULL,
            descripcion TEXT,
            url_comprobante TEXT DEFAULT NULL,
            activo INTEGER DEFAULT 1
        );
    `;
    db.run(sql);
}

// Escritas nativas en OPFS mediante navigator.storage.getDirectory()
async function guardarEnOPFS() {
    if (!db) return;
    const data = db.export();
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(NOMBRE_DB, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
}

// Inserción vía SQL (INSERT INTO)
async function guardarMovimientoSQL(correo, tipo, monto, fecha, categoria, descripcion, urlComprobante = null) {
    if (!db) await inicializarBaseDeDatos();
    const sql = `
        INSERT INTO movimientos (correo_usuario, tipo_movimiento, monto, fecha, categoria, descripcion, url_comprobante, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;
    db.run(sql, [correo, tipo, monto, fecha, categoria, descripcion, urlComprobante]);
    await guardarEnOPFS();
}

// Lectura vía SQL (SELECT)
function obtenerMovimientosSQL(correo) {
    if (!db) return [];
    const sql = `
        SELECT id, tipo_movimiento, monto, fecha, categoria, descripcion, url_comprobante
        FROM movimientos
        WHERE correo_usuario = ? AND activo = 1
        ORDER BY fecha DESC
    `;
    const res = db.exec(sql, [correo]);
    if (res.length === 0) return [];
    
    const columnas = res[0].columns;
    return res[0].values.map(fila => {
        let obj = {};
        columnas.forEach((col, idx) => obj[col] = fila[idx]);
        return obj;
    });
}

// Actualización / Borrado Lógico vía SQL (UPDATE)
async function eliminarMovimientoLogicoSQL(idMovimiento) {
    if (!db) return;
    const sql = `UPDATE movimientos SET activo = 0 WHERE id = ?`;
    db.run(sql, [idMovimiento]);
    await guardarEnOPFS();
}

// Consulta de agregación SQL (SUM / GROUP BY)
function calcularBalanceSQL(correo) {
    if (!db) return { totalIngresos: 0, totalEgresos: 0, balanceGeneral: 0 };
    const sql = `
        SELECT tipo_movimiento, SUM(monto) as total
        FROM movimientos
        WHERE correo_usuario = ? AND activo = 1
        GROUP BY tipo_movimiento
    `;
    const res = db.exec(sql, [correo]);
    let ingresos = 0, egresos = 0;
    if (res.length > 0) {
        res[0].values.forEach(fila => {
            if (fila[0] === 'ingreso') ingresos = fila[1];
            if (fila[0] === 'egreso') egresos = fila[1];
        });
    }
    return { totalIngresos: ingresos, totalEgresos: egresos, balanceGeneral: ingresos - egresos };
}
