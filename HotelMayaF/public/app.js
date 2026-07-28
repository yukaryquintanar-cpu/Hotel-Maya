import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, runTransaction, getDocs, addDoc, query, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Configuración Firebase (Reemplazar con tus credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyCsj2M6pnWGoAKEkDjPqxG1-q5_kV9T2rU",
  authDomain: "hotel-maya-bay-76ed8.firebaseapp.com",
  projectId: "hotel-maya-bay-76ed8",
  storageBucket: "hotel-maya-bay-76ed8.firebasestorage.app",
  messagingSenderId: "1063390338191",
  appId: "1:1063390338191:web:c58dda1171c0d95effe4fa",
  measurementId: "G-512K6V57S6"
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

// ==========================================
// VIEWMODEL: Control de Pantallas (SPA)
// ==========================================
const app = {
    showScreen: (screenId) => {
        document.querySelectorAll('.pantalla').forEach(p => p.classList.add('d-none'));
        document.getElementById(screenId).classList.remove('d-none');
        
        if(screenId === 'history-screen') loadHistory();
        if(screenId === 'admin-screen') loadAllReservations(); // Línea nueva
    }
};
window.app = app; // Exponer para los onclick del HTML

// ==========================================
// AUTENTICACIÓN 
// ==========================================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('mainNav').classList.remove('d-none');
        document.getElementById('mainFooter').classList.remove('d-none'); // AÑADIR ESTA LÍNEA
        app.showScreen('home-screen');
        
        // Ponemos el correo en la pantalla
        document.getElementById('profileEmail').innerText = user.email;
        
        // Buscamos si el usuario ya guardó sus datos antes
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('perfilNombre').value = data.nombre || '';
            document.getElementById('perfilTelefono').value = data.telefono || '';
            document.getElementById('profileNameDisplay').innerText = data.nombre || 'Usuario';
            
            // ---> AQUÍ ESTÁ LA NUEVA VALIDACIÓN DEL ADMINISTRADOR <---
            if (data.rol === "admin") {
                document.getElementById('btnAdminNav').classList.remove('d-none');
            } else {
                document.getElementById('btnAdminNav').classList.add('d-none');
            }
            // ---------------------------------------------------------

        } else {
            document.getElementById('profileNameDisplay').innerText = 'Nuevo Usuario';
        }
        
    } else {
        document.getElementById('mainNav').classList.add('d-none');
        document.getElementById('mainFooter').classList.add('d-none'); // AÑADIR ESTA LÍNEA
        app.showScreen('login-screen');
    }
});
// ==========================================
// GUARDAR DATOS DEL PERFIL
// ==========================================
document.getElementById('perfilForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('btnGuardarPerfil');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    const nombre = document.getElementById('perfilNombre').value;
    const telefono = document.getElementById('perfilTelefono').value;

    try {
        // setDoc con merge: true actualiza el documento si ya existe, o lo crea si es nuevo
        await setDoc(doc(db, "usuarios", auth.currentUser.uid), {
            nombre: nombre,
            telefono: telefono,
            email: auth.currentUser.email
        }, { merge: true });

        // Actualizar el título visualmente
        document.getElementById('profileNameDisplay').innerText = nombre;
        
        // Mostrar alerta de éxito
        const alerta = document.getElementById('perfilAlert');
        alerta.innerHTML = `<div class="alert alert-success py-2">Perfil actualizado con éxito.</div>`;
        
        // Borrar la alerta después de 3 segundos para que se vea limpio
        setTimeout(() => { alerta.innerHTML = ''; }, 3000);

    } catch (error) {
        document.getElementById('perfilAlert').innerHTML = `<div class="alert alert-danger py-2">Error: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Cambios";
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        alert("Error al iniciar sesión: " + error.message);
    }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

// ==========================================
// REPOSITORIO: Lógica de Habitaciones (Max 40)
// ==========================================
// Referencias a los inputs de fecha
const inputCheckin = document.getElementById('roomCheckin');
const inputCheckout = document.getElementById('roomCheckout');

// Escuchar cuando el usuario cambie las fechas en el calendario
inputCheckin.addEventListener('change', buscarHabitacionesLibres);
inputCheckout.addEventListener('change', buscarHabitacionesLibres);

async function buscarHabitacionesLibres() {
    const checkin = inputCheckin.value;
    const checkout = inputCheckout.value;
    const select = document.getElementById('roomSelect');

    if (!checkin || !checkout) {
        select.innerHTML = '<option value="">Primero elige las fechas...</option>';
        return;
    }

    if (checkin >= checkout) {
        select.innerHTML = '<option value="">La salida debe ser posterior a la entrada</option>';
        return;
    }

    select.innerHTML = '<option value="">Buscando disponibilidad...</option>';

    try {
        const habSnapshot = await getDocs(collection(db, "habitaciones"));
        let todasHabitaciones = [];
        habSnapshot.forEach(doc => todasHabitaciones.push({id: doc.id, ...doc.data()}));

        const resSnapshot = await getDocs(collection(db, "reservaciones"));
        let habitacionesOcupadas = [];

        resSnapshot.forEach(doc => {
            const reserva = doc.data();
            if (reserva.fecha_entrada < checkout && reserva.fecha_salida > checkin) {
                habitacionesOcupadas.push(reserva.habitacion_id);
            }
        });

        select.innerHTML = '<option value="">Selecciona una habitación...</option>';
        let disponibles = 0;

        todasHabitaciones.forEach(hab => {
            if (!habitacionesOcupadas.includes(hab.id)) {
                select.innerHTML += `<option value="${hab.id}">Hab ${hab.numero} - ${hab.tipo} ($${hab.precio_noche})</option>`;
                disponibles++;
            }
        });

        if (disponibles === 0) {
            select.innerHTML = '<option value="">Sin disponibilidad para estas fechas</option>';
        }
    } catch (error) {
        console.error("Error buscando:", error);
    }
}

// ==========================================
// REGLAS DE NEGOCIO Y TRANSACCIONES [cite: 63]
// Equivalente a corrutinas con async/await
// ==========================================

// 1. Reserva de Habitación
document.getElementById('roomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const habId = document.getElementById('roomSelect').value;
    const checkin = document.getElementById('roomCheckin').value;
    const checkout = document.getElementById('roomCheckout').value;
    
    if (!habId) {
        alert("Por favor selecciona una habitación.");
        return;
    }

    const btn = document.getElementById('btnBookRoom');
    btn.disabled = true;
    btn.innerText = "Procesando...";

    try {
        await addDoc(collection(db, "reservaciones"), {
            usuario_id: auth.currentUser.uid,
            habitacion_id: habId,
            fecha_entrada: checkin,
            fecha_salida: checkout,
            fecha_creacion: new Date().toISOString()
        });

        document.getElementById('roomAlert').innerHTML = `<div class="alert alert-success">Reserva exitosa</div>`;
        document.getElementById('roomForm').reset(); 
        document.getElementById('roomSelect').innerHTML = '<option value="">Primero elige las fechas...</option>'; 
        
        loadHistory();

    } catch (error) {
        document.getElementById('roomAlert').innerHTML = `<div class="alert alert-danger">${error}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Confirmar Reserva";
    }
});

// 2. Reserva de Traslado (Max 12 pax / 20 min)
document.getElementById('transferForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = document.getElementById('transDate').value;
    const bloque = document.getElementById('transTime').value; // ej. "14:00-14:20"
    const paxNuevos = parseInt(document.getElementById('transPax').value);
    
    // ID único para el control de cupos de ese bloque de 20 minutos
    const bloqueId = `${fecha}_${bloque}`;
    const refBloque = doc(db, "bloques_traslado", bloqueId);

    try {
        await runTransaction(db, async (transaction) => {
            const bloqueDoc = await transaction.get(refBloque);
            let paxActuales = 0;
            
            if (bloqueDoc.exists()) paxActuales = bloqueDoc.data().total_pasajeros;

            if (paxActuales + paxNuevos > 12) {
                throw `Cupo excedido. Solo quedan ${12 - paxActuales} lugares en este horario.`;
            }

            // Actualizar contador del bloque
            transaction.set(refBloque, { total_pasajeros: paxActuales + paxNuevos }, { merge: true });
        });

        // Registrar viaje del usuario
        await addDoc(collection(db, "traslados"), {
            usuario_id: auth.currentUser.uid,
            fecha: fecha,
            hora_inicio: bloque.split('-')[0],
            hora_fin: bloque.split('-')[1],
            pasajeros: paxNuevos
        });

        document.getElementById('transAlert').innerHTML = `<div class="alert alert-success">Traslado agendado</div>`;
    } catch (error) {
        document.getElementById('transAlert').innerHTML = `<div class="alert alert-danger">${error}</div>`;
    }
});

// 3. Cargar Historial (Mis Viajes)
async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="col-12"><p class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando tu itinerario...</p></div>';
    
    try {
        // Consultar reservaciones de habitaciones
        const qRooms = query(collection(db, "reservaciones"), where("usuario_id", "==", auth.currentUser.uid));
        const snapRooms = await getDocs(qRooms);
        
        // Consultar reservaciones de traslados
        const qTrans = query(collection(db, "traslados"), where("usuario_id", "==", auth.currentUser.uid));
        const snapTrans = await getDocs(qTrans);
        
        list.innerHTML = ''; // Limpiamos el mensaje de carga
        let tieneViajes = false;

        // 1. Renderizar Tarjetas de Habitaciones
        snapRooms.forEach(doc => {
            tieneViajes = true;
            const data = doc.data();
            list.innerHTML += `
                <div class="col-md-6 mb-4">
                    <div class="card shadow-sm h-100 border-0" style="border-left: 5px solid var(--dorado);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title mb-0" style="color: var(--azul-medianoche); font-weight: bold;">
                                    <i class="fas fa-bed"></i> Estancia
                                </h5>
                                <span class="badge bg-light text-dark border">Ref: ${doc.id.substring(0,6).toUpperCase()}</span>
                            </div>
                            <div class="row mb-2">
                                <div class="col-6">
                                    <p class="text-muted mb-0 small">Check-in</p>
                                    <p class="fw-bold mb-0">${data.fecha_entrada}</p>
                                </div>
                                <div class="col-6">
                                    <p class="text-muted mb-0 small">Check-out</p>
                                    <p class="fw-bold mb-0">${data.fecha_salida}</p>
                                </div>
                            </div>
                            <hr class="my-2">
                            <p class="mb-0 text-muted small"><i class="fas fa-door-closed"></i> Habitación asignada: ${data.habitacion_id}</p>
                        </div>
                    </div>
                </div>`;
        });

        // 2. Renderizar Tarjetas de Traslados
        snapTrans.forEach(doc => {
            tieneViajes = true;
            const data = doc.data();
            list.innerHTML += `
                <div class="col-md-6 mb-4">
                    <div class="card shadow-sm h-100 border-0" style="border-left: 5px solid var(--azul-medianoche);">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title mb-0" style="color: var(--azul-medianoche); font-weight: bold;">
                                    <i class="fas fa-shuttle-van"></i> Traslado Aeropuerto
                                </h5>
                                <span class="badge bg-light text-dark border">Ref: ${doc.id.substring(0,6).toUpperCase()}</span>
                            </div>
                            <div class="row mb-2">
                                <div class="col-6">
                                    <p class="text-muted mb-0 small">Fecha Vuelo</p>
                                    <p class="fw-bold mb-0">${data.fecha}</p>
                                </div>
                                <div class="col-6">
                                    <p class="text-muted mb-0 small">Horario Bloque</p>
                                    <p class="fw-bold mb-0">${data.hora_inicio} a ${data.hora_fin}</p>
                                </div>
                            </div>
                            <hr class="my-2">
                            <p class="mb-0 text-muted small"><i class="fas fa-users"></i> Pasajeros confirmados: ${data.pasajeros}</p>
                        </div>
                    </div>
                </div>`;
        });

        // Si la base de datos no devolvió nada
        if (!tieneViajes) {
            list.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-suitcase-rolling fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">Aún no tienes reservaciones</h5>
                    <p class="text-muted small">Tus próximas estancias y traslados aparecerán aquí.</p>
                </div>`;
        }

    } catch (error) {
        console.error("Error al cargar historial:", error);
        list.innerHTML = '<div class="col-12"><div class="alert alert-danger">Hubo un problema al cargar tu itinerario.</div></div>';
    }
}

// SCRIPT TEMPORAL PARA CREAR LAS 40 HABITACIONES
window.generarInventario = async () => {
    try {
        for(let i = 1; i <= 40; i++) {
            // Se crea el ID como pide el documento: hab_1, hab_2, etc.
            const habId = `hab_${i}`; 
            await setDoc(doc(db, "habitaciones", habId), {
                numero: i,
                tipo: i <= 20 ? "Deluxe" : "Suite",
                estatus: "disponible",
                precio_noche: i <= 20 ? 1850.00 : 2500.00
            });
            console.log(`Creada habitación ${i}`);
        }
        alert("¡Las 40 habitaciones se han creado en Firebase! Recarga la página.");
    } catch (error) {
        console.error("Error al crear habitaciones:", error);
    }
};

// ==========================================
// REGISTRAR NUEVO USUARIO
// ==========================================
document.getElementById('btnRegistrar').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const alerta = document.getElementById('loginAlert');
    const btnReg = document.getElementById('btnRegistrar');

    // Validaciones básicas
    if(!email || !pass) {
        alerta.innerHTML = `<div class="alert alert-warning py-2 small mt-2">Escribe un correo y contraseña para registrarte.</div>`;
        return;
    }

    if(pass.length < 6) {
        alerta.innerHTML = `<div class="alert alert-warning py-2 small mt-2">La contraseña debe tener al menos 6 caracteres.</div>`;
        return;
    }

    try {
        btnReg.disabled = true;
        btnReg.innerText = "Creando...";
        
        // Esto crea el usuario en tu base de datos de Firebase
        await createUserWithEmailAndPassword(auth, email, pass);
        
        // Nota: Al registrarse exitosamente, Firebase inicia sesión en automático, 
        // por lo que tu función onAuthStateChanged detectará el ingreso y te mandará a la pantalla principal.

    } catch (error) {
        let mensajeError = "Error al registrar.";
        if(error.code === 'auth/email-already-in-use') mensajeError = "Este correo ya está registrado.";
        if(error.code === 'auth/invalid-email') mensajeError = "El formato del correo no es válido.";
        
        alerta.innerHTML = `<div class="alert alert-danger py-2 small mt-2">${mensajeError}</div>`;
        btnReg.disabled = false;
        btnReg.innerText = "Registrarse";
    }
});

// ==========================================
// VISTA DE ADMINISTRADOR
// ==========================================
window.loadAllReservations = async () => {
    const list = document.getElementById('adminList');
    list.innerHTML = '<div class="col-12"><p class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando base de datos...</p></div>';
    
    try {
        // Traemos TODAS las reservaciones (sin filtrar por usuario)
        const snapRooms = await getDocs(collection(db, "reservaciones"));
        
        list.innerHTML = '';
        let contador = 0;

        snapRooms.forEach(doc => {
            contador++;
            const data = doc.data();
            list.innerHTML += `
                <div class="col-md-4 mb-3">
                    <div class="card shadow-sm h-100 border-0" style="border-left: 5px solid var(--rojo-peligro);">
                        <div class="card-body">
                            <h6 class="card-title text-danger mb-2"><i class="fas fa-lock"></i> Habitación: ${data.habitacion_id}</h6>
                            <p class="mb-0 small text-muted"><strong>Cliente UID:</strong></p>
                            <p class="mb-2 small" style="word-break: break-all;">${data.usuario_id}</p>
                            <hr class="my-2">
                            <div class="d-flex justify-content-between small">
                                <span><strong>In:</strong> ${data.fecha_entrada}</span>
                                <span><strong>Out:</strong> ${data.fecha_salida}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        if (contador === 0) {
            list.innerHTML = '<p class="text-muted">Aún no hay reservaciones en el hotel.</p>';
        }

    } catch (error) {
        console.error("Error al cargar admin:", error);
        list.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error al cargar la base de datos.</div></div>';
    }
};