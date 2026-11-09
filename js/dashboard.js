// Clave de API pública para la subida de comprobantes a ImgBB
const IMGBB_API_KEY = "3b08e5c3c0df93608226065476a6d6d8"; 

/**
 * Petición asincrónica (fetch / async-await) a API REST usando FormData.
 * Cumple resiliencia y manejo de excepciones (try/catch).
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
            return data.data.url; // Retorna únicamente la URL pública
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

            // 1. Sube la imagen a la API REST (o retorna null si falla/no hay)
            const urlComprobante = await subirComprobanteAPI(fileInput);

            // 2. Guarda el registro vía SQL puro en la base SQLite/OPFS
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
}

async function ejecutarBajaLogica(id) {
    if (confirm("¿Confirmar eliminación del registro?")) {
        await eliminarMovimientoLogicoSQL(id);
        renderizarPantalla();
    }
}
