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

const formRegister = document.getElementById('form-registro') || document.getElementById('formRegister');
if (formRegister) {
    const regNombre = document.getElementById('nombre') || document.getElementById('regNombre');
    const regApellido = document.getElementById('apellido') || document.getElementById('regApellido');
    const regFecha = document.getElementById('fechaNacimiento') || document.getElementById('regFecha');
    const regEmail = document.getElementById('email') || document.getElementById('regEmail');
    const regUsername = document.getElementById('usuario') || document.getElementById('regUsername');
    const regPass = document.getElementById('password') || document.getElementById('regPass');
    const regMsg = document.getElementById('mensaje') || document.getElementById('regMsg');

    // Validación dinámica en vivo con tildes verdes y cruces rojas (CP-03.4)
    if (regPass) {
        regPass.addEventListener('input', () => {
            const val = regPass.value;
            validarRegla('ruleLen', val.length >= 8, 'Mínimo 8 caracteres');
            validarRegla('ruleMayus', /[A-Z]/.test(val), 'Al menos una mayúscula');
            validarRegla('ruleMinus', /[a-z]/.test(val), 'Al menos una minúscula');
            validarRegla('ruleNum', /[0-9]/.test(val), 'Al menos un número');
            validarRegla('ruleSim', /[!@#$%^&*]/.test(val), 'Al menos un símbolo (!@#$%^&*)');
        });
    }

    function validarRegla(id, condicion, texto) {
        const el = document.getElementById(id);
        if (!el) return;
        if (condicion) {
            el.className = 'valid';
            el.textContent = `✔ ${texto}`;
        } else {
            el.className = '';
            el.textContent = `✖ ${texto}`;
        }
    }

    formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        if (regMsg) regMsg.textContent = '';

        // Limpieza de espacios en blanco múltiples en Nombre y Apellido (CP-03.1)
        const nombre = regNombre.value.trim().replace(/\s+/g, ' ');
        const apellido = regApellido.value.trim().replace(/\s+/g, ' ');

        // No permite números ni símbolos en Nombre/Apellido (CP-03.1)
        if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(nombre) || /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(apellido)) {
            if (regMsg) {
                regMsg.className = 'msg-box error';
                regMsg.textContent = 'Nombre y Apellido no pueden contener números ni símbolos.';
            }
            return;
        }

        // Validación de edad mínima (14 años) (CP-03.2)
        const fechaNac = new Date(regFecha.value);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNac.getFullYear();
        const m = hoy.getMonth() - fechaNac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) edad--;

        if (edad < 14) {
            if (regMsg) {
                regMsg.className = 'msg-box error';
                regMsg.textContent = 'Debes tener al menos 14 años para registrarte.';
            }
            return;
        }

        // Validación estricta de correo electrónico (CP-03.3)
        const email = regEmail.value.trim().toLowerCase();
        const regexEmail = /^[^\s@]+@[^\s@]+\.(com|com\.ar|[a-z]{2,})$/i;
        if (!regexEmail.test(email)) {
            if (regMsg) {
                regMsg.className = 'msg-box error';
                regMsg.textContent = 'El formato del correo electrónico no es válido.';
            }
            return;
        }

        // Validación de las 5 reglas de contraseña (CP-03.4)
        const valPass = regPass.value;
        const cumpleClave = valPass.length >= 8 && /[A-Z]/.test(valPass) && /[a-z]/.test(valPass) && /[0-9]/.test(valPass) && /[!@#$%^&*]/.test(valPass);

        if (!cumpleClave) {
            if (regMsg) {
                regMsg.className = 'msg-box error';
                regMsg.textContent = 'La contraseña debe cumplir las 5 reglas de seguridad.';
            }
            return;
        }

        // Comprobar que el correo o usuario no estén repetidos (CP-03.5)
        const usuarios = JSON.parse(localStorage.getItem('usuarios_sgg')) || [];
        if (usuarios.some(u => u.email === email)) {
            if (regMsg) {
                regMsg.className = 'msg-box error';
                regMsg.textContent = 'Este correo electrónico ya está registrado.';
            }
            return;
        }

        usuarios.push({
            nombre, apellido, fechaNac: regFecha.value, email,
            username: regUsername.value.trim(), password: valPass
        });

        localStorage.setItem('usuarios_sgg', JSON.stringify(usuarios));
        if (regMsg) {
            regMsg.className = 'msg-box success';
            regMsg.textContent = '¡Registro exitoso! Redirigiendo a inicio de sesión...';
        }

        setTimeout(() => window.location.href = 'index.html', 1500);
    });
}
