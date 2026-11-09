const IMGBB_API_KEY = "3b08e5c3c0df93608226065476a6d6d8"; 

// Variables globales para las instancias de Chart.js
let chartCategoriasInstance = null;
let chartBalanceInstance = null;

/**
 * Petición asincrónica a la API REST de ImgBB con FormData
 */
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
    await inicializarBaseDeDatos();
    renderizarPantalla();

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

    // Actualiza el módulo de reportes (Chart.js)
    renderizarGraficos("usuario@ejemplo.com");
}

/**
 * Renderiza los dos gráficos interactivos exigidos por el Punto 5
 */
function renderizarGraficos(correo) {
    const ctxCat = document.getElementById("chartCategorias");
    const ctxBal = document.getElementById("chartBalance");

    if (!ctxCat || !ctxBal) return;

    // 1. Gráfico de Pie/Dona: Egresos por Categoría (Alimentado por SQL GROUP BY)
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

    // 2. Gráfico de Barras: Ingresos vs Egresos (Alimentado por SQL GROUP BY)
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
        await eliminarMovimientoLogicoSQL(id);
        renderizarPantalla();
    }
}
