let db = null;
const NOMBRE_DB = "gastos.sqlite";

// Configuración de Supabase (BaaS)
const SUPABASE_URL = "https://tu-proyecto.supabase.co"; // Reemplazar con tu URL de Supabase
const SUPABASE_ANON_KEY = "tu-anon-key-de-supabase";    // Reemplazar con tu anon key
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/**
 * Inicialización con Flujo Offline-First:
 * 1. Intenta descargar el binario .sqlite desde el BaaS (Supabase Storage).
 * 2. Si lo encuentra, actualiza el archivo en OPFS local.
 * 3. Si no hay conexión o falla, carga la base de datos binaria local existente en OPFS.
 */
async function inicializarBaseDeDatos(correoUsuario = "usuario@ejemplo.com") {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    const root = await navigator.storage.getDirectory();

    // Intentar sincronizar desde BaaS a OPFS (Offline-First)
    await descargarBaseDeDatosDesdeBaaS(correoUsuario, root);

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

/**
 * Descarga el binario .sqlite del BaaS y lo guarda localmente en OPFS
 */
async function descargarBaseDeDatosDesdeBaaS(correoUsuario, root) {
    if (!supabaseClient) return;

    try {
        const rutaArchivo = `respaldos/${correoUsuario}/${NOMBRE_DB}`;
        const { data, error } = await supabaseClient.storage.from("bases_datos").download(rutaArchivo);

        if (error) {
            console.log("No se encontró respaldo previo en BaaS o estás en modo Offline. Usando OPFS local.");
            return;
        }

        if (data) {
            const buffer = await data.arrayBuffer();
            const fileHandle = await root.getFileHandle(NOMBRE_DB, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(buffer);
            await writable.close();
            console.log("Base de datos sincronizada exitosamente desde BaaS a OPFS.");
        }
    } catch (err) {
        console.warn("Falla de red al intentar descargar respaldo de BaaS. Continuando con copia local OPFS:", err);
    }
}

/**
 * Respalda el archivo binario .sqlite extraído de OPFS hacia el BaaS (Supabase Storage)
 */
async function subirBaseDeDatosABaaS(correoUsuario = "usuario@ejemplo.com") {
    if (!db || !supabaseClient) return false;

    try {
        const dataBinaria = db.export();
        const blob = new Blob([dataBinaria], { type: "application/x-sqlite3" });
        const rutaArchivo = `respaldos/${correoUsuario}/${NOMBRE_DB}`;

        const { error } = await supabaseClient.storage.from("bases_datos").upload(rutaArchivo, blob, {
            upsert: true
        });

        if (error) throw error;
        console.log("Binario .sqlite respaldado con éxito en BaaS (Supabase Storage).");
        return true;
    } catch (err) {
        console.warn("No se pudo respaldar en BaaS (sin conexión o error de API):", err);
        return false;
    }
}

// Estructura de tabla SQL estándar
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

// Escritura asincrónica en OPFS
async function guardarEnOPFS() {
    if (!db) return;
    const data = db.export();
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(NOMBRE_DB, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
}

// Operación INSERT INTO vía SQL y respaldo en BaaS
async function guardarMovimientoSQL(correo, tipo, monto, fecha, categoria, descripcion, urlComprobante = null) {
    if (!db) await inicializarBaseDeDatos(correo);
    const sql = `
        INSERT INTO movimientos (correo_usuario, tipo_movimiento, monto, fecha, categoria, descripcion, url_comprobante, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;
    db.run(sql, [correo, tipo, monto, fecha, categoria, descripcion, urlComprobante]);
    await guardarEnOPFS();
    
    // Intenta sincronizar el binario actualizado al BaaS en segundo plano
    subirBaseDeDatosABaaS(correo);
}

// Operación SELECT vía SQL (Solo activos)
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

// Operación UPDATE (Borrado Lógico) vía SQL
async function eliminarMovimientoLogicoSQL(idMovimiento, correo = "usuario@ejemplo.com") {
    if (!db) return;
    const sql = `UPDATE movimientos SET activo = 0 WHERE id = ?`;
    db.run(sql, [idMovimiento]);
    await guardarEnOPFS();
    subirBaseDeDatosABaaS(correo);
}

// Agregación SUM / GROUP BY vía SQL para balance dinámico
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

// Agregación SQL: Egresos por categoría
function obtenerEgresosPorCategoriaSQL(correo) {
    if (!db) return { categorias: [], montos: [] };
    const sql = `
        SELECT categoria, SUM(monto) as total
        FROM movimientos
        WHERE correo_usuario = ? AND tipo_movimiento = 'egreso' AND activo = 1
        GROUP BY categoria
    `;
    const res = db.exec(sql, [correo]);
    if (res.length === 0) return { categorias: [], montos: [] };

    const categorias = [];
    const montos = [];
    res[0].values.forEach(fila => {
        categorias.push(fila[0]);
        montos.push(fila[1]);
    });

    return { categorias, montos };
}
