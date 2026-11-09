// Variable global para mantener la referencia a la base de datos SQLite
let db = null;
const NOMBRE_DB = "gastos.sqlite";

/**
 * 1. Inicializa la Base de Datos SQLite en el navegador utilizando sql.js (WebAssembly)
 * y la persiste localmente en la memoria nativa OPFS.
 */
async function inicializarBaseDeDatos() {
    try {
        // Cargar motor sql.js desde CDN WebAssembly
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        // Obtener el directorio privado nativo OPFS del navegador
        const root = await navigator.storage.getDirectory();

        try {
            // Intentar recuperar el archivo binario si ya existe
            const fileHandle = await root.getFileHandle(NOMBRE_DB);
            const file = await fileHandle.getFile();
            const buffer = await file.arrayBuffer();
            db = new SQL.Database(new Uint8Array(buffer));
            console.log("Base de datos SQLite cargada exitosamente desde OPFS.");
        } catch (errorNoExiste) {
            // Si el archivo no existe aún, se crea una base de datos SQLite nueva
            console.log("Creando nueva base de datos SQLite en OPFS...");
            db = new SQL.Database();
            crearTablasIniciales();
            await guardarEnOPFS();
        }
    } catch (err) {
        console.error("Error al inicializar la base de datos SQLite:", err);
    }
}

/**
 * 2. Crea la tabla 'movimientos' con el campo 'tipo_movimiento' y el borrado lógico ('activo').
 */
function crearTablasIniciales() {
    if (!db) return;

    const sqlScript = `
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
    db.run(sqlScript);
    console.log("Tabla 'movimientos' configurada correctamente.");
}

/**
 * 3. Guarda físicamente el archivo binario .sqlite en el disco duro (OPFS).
 */
async function guardarEnOPFS() {
    if (!db) return;

    try {
        const dataBinaria = db.export(); // Extrae los datos binarios de la BD
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(NOMBRE_DB, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(dataBinaria);
        await writable.close();
        console.log("Cambios guardados con éxito en OPFS.");
    } catch (err) {
        console.error("Error al guardar en OPFS:", err);
    }
}

/**
 * 4. Registrar un movimiento (Ingreso o Egreso)
 */
async function guardarMovimientoSQL(correo, tipo, monto, fecha, categoria, descripcion, urlComprobante = null) {
    if (!db) await inicializarBaseDeDatos();

    const sql = `
        INSERT INTO movimientos (correo_usuario, tipo_movimiento, monto, fecha, categoria, descripcion, url_comprobante, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;

    db.run(sql, [correo, tipo, monto, fecha, categoria, descripcion, urlComprobante]);
    await guardarEnOPFS(); // Persistir cambios en disco
}

/**
 * 5. Obtener el historial activo del usuario (Filtra borrado lógico: activo = 1)
 */
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

    // Formatear los resultados en un array de objetos
    const columnas = res[0].columns;
    return res[0].values.map(fila => {
        let obj = {};
        columnas.forEach((col, idx) => {
            obj[col] = fila[idx];
        });
        return obj;
    });
}

/**
 * 6. Borrado Lógico: Cambia la columna 'activo' a 0 (no borra físicamente el registro)
 */
async function eliminarMovimientoLogicoSQL(idMovimiento) {
    if (!db) return;

    const sql = `UPDATE movimientos SET activo = 0 WHERE id = ?`;
    db.run(sql, [idMovimiento]);
    await guardarEnOPFS(); // Persistir cambios en disco
}

/**
 * 7. Recalcular Balance Acumulado (Ingresos - Egresos)
 */
function calcularBalanceSQL(correo) {
    if (!db) return { totalIngresos: 0, totalEgresos: 0, balanceGeneral: 0 };

    const sql = `
        SELECT tipo_movimiento, SUM(monto) as total
        FROM movimientos
        WHERE correo_usuario = ? AND activo = 1
        GROUP BY tipo_movimiento
    `;

    const res = db.exec(sql, [correo]);
    let ingresos = 0;
    let egresos = 0;

    if (res.length > 0) {
        res[0].values.forEach(fila => {
            if (fila[0] === 'ingreso') ingresos = fila[1];
            if (fila[0] === 'egreso') egresos = fila[1];
        });
    }

    return {
        totalIngresos: ingresos,
        totalEgresos: egresos,
        balanceGeneral: ingresos - egresos
    };
}
