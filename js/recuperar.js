// CONTROL DE MODO DÍA / NOCHE (RF-02)
document.addEventListener('DOMContentLoaded', () => {
    const btnTema = document.getElementById('btn-tema') || document.getElementById('btnTheme');
    if (localStorage.getItem('tema_sgg') === 'oscuro') {
        document.body.classList.add('modo-noche');
    }
    if (btnTema) {
        btnTema.addEventListener('click', () => {
            document.body.classList.toggle('modo-noche');
            const esOscuro = document.body.classList.contains('modo-noche');
            localStorage.setItem('tema_sgg', esOscuro ? 'oscuro' : 'claro');
        });
    }
});

// MOSTRAR / OCULTAR CONTRASEÑA
window.mostrarOcultarPassword = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = 'Ocultar';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = 'Mostrar';
    }
};

const formRecuperar = document.getElementById('form-recuperar') || document.getElementById('formRecuperar');
if (formRecuperar) {
    formRecuperar.addEventListener('submit', (e) => {
        e.preventDefault();
        const recMsg = document.getElementById('mensaje') || document.getElementById('recMsg');
        const emailEl = document.getElementById('email') || document.getElementById('recEmail');
        const newPassEl = document.getElementById('nuevaPassword') || document.getElementById('recNewPass');
        const confirmPassEl = document.getElementById('confirmarPassword') || document.getElementById('recConfirmPass');

        const email = emailEl.value.trim().toLowerCase();
        const newPass = newPassEl.value;
        const confirmPass = confirmPassEl.value;

        // Comprobar que las dos contraseñas coincidan (CP-04.3)
        if (newPass !== confirmPass) {
            if (recMsg) {
                recMsg.className = 'msg-box error';
                recMsg.textContent = 'Las contraseñas ingresadas no coinciden.';
            }
            return;
        }

        // Verificar que cumpla las 5 reglas (CP-04.3)
        const cumpleClave = newPass.length >= 8 && /[A-Z]/.test(newPass) && /[a-z]/.test(newPass) && /[0-9]/.test(newPass) && /[!@#$%^&*]/.test(newPass);
        if (!cumpleClave) {
            if (recMsg) {
                recMsg.className = 'msg-box error';
                recMsg.textContent = 'La nueva contraseña debe cumplir con las 5 reglas de seguridad.';
            }
            return;
        }

        let usuarios = JSON.parse(localStorage.getItem('usuarios_sgg')) || [];
        const idx = usuarios.findIndex(u => u.email === email);

        if (idx === -1) {
            if (recMsg) {
                recMsg.className = 'msg-box error';
                recMsg.textContent = 'El correo electrónico no se encuentra registrado en el sistema.';
            }
            return;
        }

        // No permitir que use la misma contraseña actual (CP-04.2)
        if (usuarios[idx].password === newPass) {
            if (recMsg) {
                recMsg.className = 'msg-box error';
                recMsg.textContent = 'La nueva contraseña no puede ser igual a la clave actual.';
            }
            return;
        }

        // Actualizar clave y enviar al login (CP-04.1)
        usuarios[idx].password = newPass;
        localStorage.setItem('usuarios_sgg', JSON.stringify(usuarios));

        if (recMsg) {
            recMsg.className = 'msg-box success';
            recMsg.textContent = '¡Contraseña actualizada con éxito! Redirigiendo al inicio de sesión...';
        }

        setTimeout(() => window.location.href = 'index.html', 1500);
    });
}
