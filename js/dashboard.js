<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Gestión de Gastos - Dashboard</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <!-- Encabezado y Navegación Principal -->
    <header>
        <h1>Sistema de Gestión de Gastos</h1>
        <nav>
            <button id="btnCambiarTema">Modo Día / Noche</button>
            <button id="btnCerrarSesion">Cerrar Sesión</button>
        </nav>
    </header>

    <!-- Contenido Principal -->
    <main>

        <!-- Panel Superior: Resumen de Balance -->
        <section id="resumen-balance">
            <h2>Resumen General</h2>
            <div>
                <p>Total Gastado: <span id="totalGastado">$0</span></p>
            </div>
        </section>

        <!-- Formulario para Registrar Gastos o Ingresos -->
        <section id="formulario-gasto">
            <h2>Cargar Movimiento</h2>
            <form id="formGasto">
                <div>
                    <label for="tipoMovimiento">Tipo de Movimiento:</label>
                    <select id="tipoMovimiento" required>
                        <option value="egreso">Egreso (Gasto)</option>
                        <option value="ingreso">Ingreso</option>
                    </select>
                </div>

                <div>
                    <label for="monto">Monto:</label>
                    <input type="number" id="monto" step="0.01" min="0.01" placeholder="Ej: 1500.50" required>
                </div>

                <div>
                    <label for="fecha">Fecha:</label>
                    <input type="date" id="fecha" required>
                </div>

                <div>
                    <label for="categoria">Categoría:</label>
                    <select id="categoria" required>
                        <option value="">Seleccione una categoría</option>
                        <option value="Comida">Comida</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Servicios">Servicios</option>
                        <option value="Entretenimiento">Entretenimiento</option>
                        <option value="Otros">Otros</option>
                    </select>
                </div>

                <div>
                    <label for="descripcion">Descripción:</label>
                    <input type="text" id="descripcion" placeholder="Breve detalle del movimiento">
                </div>

                <!-- Campo Opcional para Comprobante (Punto 4 API REST) -->
                <div>
                    <label for="comprobante">Comprobante (Opcional):</label>
                    <input type="file" id="comprobante" accept="image/*">
                </div>

                <button type="submit">Guardar Movimiento</button>
            </form>
        </section>

        <!-- Tabla con el Historial de Movimientos -->
        <section id="historial-gastos">
            <h2>Historial de Movimientos</h2>
            <table border="1">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Comprobante</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="tablaGastosBody">
                    <!-- Los registros guardados se cargarán aquí dinámicamente -->
                </tbody>
            </table>
        </section>

    </main>

    <!-- LIBRERÍAS Y SCRIPTS EN ORDEN ESTRICTO DE ARQUITECTURA -->
    <!-- 1. Motor oficial de SQLite impulsado por WebAssembly -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"></script>
    
    <!-- 2. Capa de Persistencia Relacional y OPFS -->
    <script src="js/db.js"></script>

    <!-- 3. Capa de Lógica de Interfaz de Usuario y API REST -->
    <script src="js/dashboard.js"></script>

</body>
</html>
