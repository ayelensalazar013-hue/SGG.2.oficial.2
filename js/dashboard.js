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

            await guardarMovimientoSQL("usuario@ejemplo.com", tipo, monto, fecha, categoria, descripcion, null);
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
        tr.innerHTML = `
            <td>${mov.tipo_movimiento}</td>
            <td>$${mov.monto.toFixed(2)}</td>
            <td>${mov.fecha}</td>
            <td>${mov.categoria}</td>
            <td>${mov.descripcion || "-"}</td>
            <td><button onclick="ejecutarBajaLogica(${mov.id})">Eliminar</button></td>
        `;
        tablaBody.appendChild(tr);
    });

    const balance = calcularBalanceSQL("usuario@ejemplo.com");
    if (totalGastadoSpan) {
        totalGastadoSpan.textContent = `$${balance.balanceGeneral.toFixed(2)}`;
    }
}

async function ejecutarBajaLogica(id) {
    if (confirm("¿Confirmar eliminación lógica del registro?")) {
        await eliminarMovimientoLogicoSQL(id);
        renderizarPantalla();
    }
}
