const IMGBB_API_KEY = "3b08e5c3c0df93608226065476a6d6d8";

let chartCategoriasInstance = null;
let idMovimientoEditando = null;
let idMovimientoAEliminar = null;

function obtenerCorreoActivo() {
    try {
        const usuarioActivo = JSON.parse(localStorage.getItem("usuario_activo_sgg"));
        if (usuarioActivo && usuarioActivo.email) {
            return usuarioActivo.email;
        }
    } catch (e) {
        console.warn("No se pudo leer usuario activo:", e);
    }
    return "usuario@ejemplo.com";
}

function obtenerFechaHoyLocal() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function mostrarMensajeFormulario(texto, tipo = "error") {
    const box = document.getElementById("mensajeMovimiento");
    if (!box) return;
    box.textContent = texto;
    box.className = tipo ? `msg-box ${tipo}` : "msg-box";
}

async function subirComprobanteAPI(fileInput) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return null;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error?.message || "Error devuelto por la API REST");
        }
    } catch (error) {
        console.warn("Falla de red o API al subir comprobante. Se guardará como NULL:", error);
        mostrarMensajeFormulario("Atención: No se pudo subir el comprobante. El movimiento se registrará sin la imagen.", "error");
        return null;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const correoUsuario = obtenerCorreoActivo();

    const btnCerrarSesion = document.getElementById("btnCerrarSesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", () => {
            localStorage.removeItem("usuario_activo_sgg");
            window.location.href = "index.html";
        });
    }

    // Limitar fecha máxima al día actual en el input date (CU-05 y CU-07)
    const inputFecha = document.getElementById("fecha");
    if (inputFecha) {
        inputFecha.max = obtenerFechaHoyLocal();
    }

    // Inicializa la DB usando el flujo Offline-First
    await inicializarBaseDeDatos(correoUsuario);
    renderizarPantalla();

    // Evento del botón para sincronización manual con la nube (BaaS)
    const btnSincronizar = document.getElementById("btnSincronizarNube");
    if (btnSincronizar) {
        btnSincronizar.addEventListener("click", async () => {
            const estadoSpan = document.getElementById("estadoSincronizacion");
            if (estadoSpan) estadoSpan.textContent = "Estado: Sincronizando con la Nube...";
            
            const exito = await subirBaseDeDatosABaaS(correoUsuario);
            if (exito) {
                if (estadoSpan) estadoSpan.textContent = "Estado: Sincronizado en la Nube";
            } else {
                if (estadoSpan) estadoSpan.textContent = "Estado: Modo Local (Offline-First) - Datos seguros en OPFS";
            }
        });
    }

    // Botón para cancelar la edición (CU-07)
    const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
    if (btnCancelarEdicion) {
        btnCancelarEdicion.addEventListener("click", () => {
            salirModoEdicion();
        });
    }

    // Modal de confirmación de borrado lógico (CU-08)
    const modalEliminar = document.getElementById("modalEliminar");
    const btnConfirmarEliminar = document.getElementById("btnConfirmarEliminar");
    const btnCancelarEliminar = document.getElementById("btnCancelarEliminar");

    if (btnCancelarEliminar && modalEliminar) {
        btnCancelarEliminar.addEventListener("click", () => {
            idMovimientoAEliminar = null;
            modalEliminar.style.display = "none";
        });
    }

    if (btnConfirmarEliminar && modalEliminar) {
        btnConfirmarEliminar.addEventListener("click", async () => {
            if (idMovimientoAEliminar !== null) {
                await eliminarMovimientoLogicoSQL(idMovimientoAEliminar, correoUsuario);
                idMovimientoAEliminar = null;
                modalEliminar.style.display = "none";
                mostrarMensajeFormulario("Movimiento eliminado correctamente.", "success");
                renderizarPantalla();
            }
        });
    }

    // Envío del formulario (Crear CU-05 o Editar CU-07)
    const formGasto = document.getElementById("formGasto");
    if (formGasto) {
        formGasto.addEventListener("submit", async (e) => {
            e.preventDefault();

            const tipo = document.getElementById("tipoMovimiento").value;
            const monto = parseFloat(document.getElementById("monto").value);
            const fecha = document.getElementById("fecha").value;
            const categoria = document.getElementById("categoria").value;
            const descripcion = document.getElementById("descripcion").value.trim();
            const fileInput = document.getElementById("comprobante");

            // Validación CU-05 y CU-07: monto mayor a cero
            if (isNaN(monto) || monto <= 0) {
                mostrarMensajeFormulario("Error: El monto debe ser mayor a 0.", "error");
                return;
            }

            // Validación CU-05 y CU-07: campos obligatorios y fecha no futura
            if (!fecha || !categoria) {
                mostrarMensajeFormulario("Error: Debe completar la fecha y la categoría.", "error");
                return;
            }

            if (fecha > obtenerFechaHoyLocal()) {
                mostrarMensajeFormulario("Error: La fecha no puede ser mayor a la fecha actual.", "error");
                return;
            }

            // En edición (CU-07) la descripción también se exige no vacía
            if (idMovimientoEditando !== null && descripcion === "") {
                mostrarMensajeFormulario("Error: La descripción no puede quedar vacía al editar.", "error");
                return;
            }

            const urlComprobante = await subirComprobanteAPI(fileInput);

            if (idMovimientoEditando !== null) {
                await actualizarMovimientoSQL(
                    idMovimientoEditando,
                    correoUsuario,
                    tipo,
                    monto,
                    fecha,
                    categoria,
                    descripcion,
                    urlComprobante
                );
                salirModoEdicion();
                mostrarMensajeFormulario("Movimiento actualizado correctamente.", "success");
            } else {
                await guardarMovimientoSQL(
                    correoUsuario,
                    tipo,
                    monto,
                    fecha,
                    categoria,
                    descripcion,
                    urlComprobante
                );
                formGasto.reset();
                mostrarMensajeFormulario("Movimiento registrado correctamente.", "success");
            }

            renderizarPantalla();
        });
    }
});

function renderizarPantalla() {
    const correoUsuario = obtenerCorreoActivo();
    const tablaBody = document.getElementById("tablaGastosBody");
    const totalGastadoSpan = document.getElementById("totalGastado");
    if (!tablaBody) return;

    const movimientos = obtenerMovimientosSQL(correoUsuario);
    tablaBody.innerHTML = "";

    movimientos.forEach(mov => {
        const tr = document.createElement("tr");
        
        const linkComprobante = mov.url_comprobante 
            ? `<a href="${mov.url_comprobante}" target="_blank">Ver Comprobante</a>` 
            : "-";

        tr.innerHTML = `
            <td>${mov.tipo_movimiento}</td>
            <td>$${mov.monto.toFixed(2)}</td>
            <td>${mov.fecha}</td>
            <td>${mov.categoria}</td>
            <td>${mov.descripcion || "-"}</td>
            <td>${linkComprobante}</td>
            <td class="acciones-cell">
                <button type="button" class="btn-tabla btn-editar" onclick="prepararEdicion(${mov.id})">Editar</button>
                <button type="button" class="btn-tabla btn-eliminar" onclick="abrirModalEliminar(${mov.id})">Eliminar</button>
            </td>
        `;
        tablaBody.appendChild(tr);
    });

    // CU-09: Suma total de egresos activos en pantalla
    const balance = calcularBalanceSQL(correoUsuario);
    if (totalGastadoSpan) {
        totalGastadoSpan.textContent = `$${balance.totalEgresos.toFixed(2)}`;
    }

    renderizarGraficos(correoUsuario);
}

// CU-07: Cargar datos actuales del movimiento en el formulario para editar
window.prepararEdicion = function(id) {
    const correoUsuario = obtenerCorreoActivo();
    const movimientos = obtenerMovimientosSQL(correoUsuario);
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;

    idMovimientoEditando = mov.id;
    document.getElementById("tipoMovimiento").value = mov.tipo_movimiento;
    document.getElementById("monto").value = mov.monto;
    document.getElementById("fecha").value = mov.fecha;
    document.getElementById("categoria").value = mov.categoria;
    document.getElementById("descripcion").value = mov.descripcion || "";

    const tituloForm = document.getElementById("tituloFormularioGasto");
    const btnGuardar = document.getElementById("btn-guardar-gasto");
    const btnCancelar = document.getElementById("btnCancelarEdicion");

    if (tituloForm) tituloForm.textContent = "Editar Movimiento";
    if (btnGuardar) btnGuardar.textContent = "Guardar Cambios";
    if (btnCancelar) btnCancelar.style.display = "block";

    mostrarMensajeFormulario("Editando movimiento seleccionado. Modificá los datos y guardá.", "");
    document.getElementById("formulario-gasto").scrollIntoView({ behavior: "smooth" });
};

function salirModoEdicion() {
    idMovimientoEditando = null;
    const formGasto = document.getElementById("formGasto");
    if (formGasto) formGasto.reset();

    const tituloForm = document.getElementById("tituloFormularioGasto");
    const btnGuardar = document.getElementById("btn-guardar-gasto");
    const btnCancelar = document.getElementById("btnCancelarEdicion");

    if (tituloForm) tituloForm.textContent = "Cargar Movimiento";
    if (btnGuardar) btnGuardar.textContent = "Guardar Movimiento";
    if (btnCancelar) btnCancelar.style.display = "none";
}

// CU-08: Mostrar pequeña ventana modal pidiendo confirmación
window.abrirModalEliminar = function(id) {
    idMovimientoAEliminar = id;
    const modalEliminar = document.getElementById("modalEliminar");
    if (modalEliminar) {
        modalEliminar.style.display = "flex";
    }
};

function renderizarGraficos(correo) {
    const ctxCat = document.getElementById("chartCategorias");
    if (!ctxCat) return;

    const datosCat = obtenerEgresosPorCategoriaSQL(correo);
    if (chartCategoriasInstance) {
        chartCategoriasInstance.destroy();
    }
    chartCategoriasInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: datosCat.categorias.length > 0 ? datosCat.categorias : ["Sin datos"],
            datasets: [{
                data: datosCat.montos.length > 0 ? datosCat.montos : [0],
                backgroundColor: ['#743e73', '#b886b7', '#FF6384', '#36A2EB', '#FFCE56']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
