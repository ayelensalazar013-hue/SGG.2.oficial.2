const IMGBB_API_KEY = "3b08e5c3c0df93608226065476a6d6d8"; 

let chartCategoriasInstance = null;
let chartBalanceInstance = null;

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
        alert("Atención: No se pudo subir el comprobante. El gasto se registrará sin la imagen.");
        return null;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // Inicializa la DB usando el flujo Offline-First (descarga desde BaaS a OPFS si existe)
    await inicializarBaseDeDatos("usuario@ejemplo.com");
    renderizarPantalla();

    // Evento del botón para sincronización manual con la nube (BaaS)
    const btnSincronizar = document.getElementById("btnSincronizarNube");
    if (btnSincronizar) {
        btnSincronizar.addEventListener("click", async () => {
            const estadoSpan = document.getElementById("estadoSincronizacion");
            if (estadoSpan) estadoSpan.textContent = "Estado: Sincronizando con la Nube...";
            
            const exito = await subirBaseDeDatosABaaS("usuario@ejemplo.com");
            if (exito) {
                alert("¡Base de datos .sqlite respaldada con éxito en la Nube (BaaS)!");
                if (estadoSpan) estadoSpan.textContent = "Estado: Sincronizado en la Nube";
            } else {
                alert("No se pudo conectar con el servicio BaaS. Tu información sigue segura localmente en OPFS.");
                if (estadoSpan) estadoSpan.textContent = "Estado: Modo Local (Offline)";
            }
        });
    }

    const formGasto = document.getElementById("formGasto");
    if (formGasto) {
        formGasto.addEventListener("submit", async (e) => {
            e.preventDefault();

            const tipo = document.getElementById("tipoMovimiento").value;
            const monto = parseFloat(document.getElementById("monto").value);
            const fecha = document.getElementById("fecha").value;
            const categoria = document.getElementById("categoria").value;
            const descripcion = document.getElementById("descripcion").value;
            const fileInput = document.getElementById("comprobante");

            const urlComprobante = await subirComprobanteAPI(fileInput);

            await guardarMovimientoSQL("usuario@ejemplo.com", tipo, monto, fecha, categoria, descripcion, urlComprobante);
            
            formGasto.reset();
            renderizarPantalla();
        });
    }
});

function renderizarPantalla() {
    const tablaBody = document.getElementById("tablaGastosBody");
    const totalGastadoSpan = document.getElementById("totalGastado");
    if (!tablaBody) return;

    const movimientos = obtenerMovimientosSQL("usuario@ejemplo.com");
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
            <td><button onclick="ejecutarBajaLogica(${mov.id})">Eliminar</button></td>
        `;
        tablaBody.appendChild(tr);
    });

    const balance = calcularBalanceSQL("usuario@ejemplo.com");
    if (totalGastadoSpan) {
        totalGastadoSpan.textContent = `$${balance.balanceGeneral.toFixed(2)}`;
    }

    renderizarGraficos("usuario@ejemplo.com");
}

function renderizarGraficos(correo) {
    const ctxCat = document.getElementById("chartCategorias");
    const ctxBal = document.getElementById("chartBalance");

    if (!ctxCat || !ctxBal) return;

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
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    const balance = calcularBalanceSQL(correo);
    if (chartBalanceInstance) {
        chartBalanceInstance.destroy();
    }
    chartBalanceInstance = new Chart(ctxBal, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Egresos'],
            datasets: [{
                label: 'Monto ($)',
                data: [balance.totalIngresos, balance.totalEgresos],
                backgroundColor: ['#2ECC71', '#E74C3C']
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

async function ejecutarBajaLogica(id) {
    if (confirm("¿Confirmar eliminación del registro?")) {
        await eliminarMovimientoLogicoSQL(id, "usuario@ejemplo.com");
        renderizarPantalla();
    }
}
